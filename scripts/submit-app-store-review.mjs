import { readFileSync } from 'node:fs'
import { sign } from 'node:crypto'

const appId = '6825791102'
const api = 'https://api.appstoreconnect.apple.com'
const keyId = process.env.APP_STORE_CONNECT_API_KEY_ID
const issuerId = process.env.APP_STORE_CONNECT_ISSUER_ID
const keyPath = process.env.APP_STORE_CONNECT_API_KEY_PATH
const marketingVersion = process.env.MARKETING_VERSION
const buildNumber = process.env.BUILD_NUMBER

if (!keyId || !issuerId || !keyPath || !marketingVersion || !buildNumber) {
  console.error('Missing App Store Connect API key or version inputs.')
  process.exit(1)
}

const privateKey = readFileSync(keyPath, 'utf8')

function token() {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(JSON.stringify({
    iss: issuerId,
    iat: now,
    exp: now + 19 * 60,
    aud: 'appstoreconnect-v1',
  })).toString('base64url')
  const input = `${header}.${payload}`
  const signature = sign('sha256', Buffer.from(input), { key: privateKey, dsaEncoding: 'ieee-p1363' })
  return `${input}.${signature.toString('base64url')}`
}

async function request(method, path, body) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  const json = text ? JSON.parse(text) : {}
  if (!response.ok) {
    console.error(`${method} ${path} failed: ${response.status}`)
    console.error(text)
    process.exit(1)
  }
  return json
}

async function waitForBuild() {
  const deadline = Date.now() + 45 * 60 * 1000
  const query = `/v1/builds?filter[app]=${appId}&filter[version]=${encodeURIComponent(buildNumber)}&limit=5`
  while (Date.now() < deadline) {
    const page = await request('GET', query)
    const build = page.data?.[0]
    const state = build?.attributes?.processingState
    if (state === 'VALID') return build.id
    if (state === 'FAILED' || state === 'INVALID') {
      console.error(`Build ${buildNumber} is ${state}.`)
      process.exit(1)
    }
    console.log(`Build ${buildNumber}: ${state ?? 'not visible yet'}`)
    await new Promise((resolve) => setTimeout(resolve, 30000))
  }
  console.error(`Build ${buildNumber} was not processed in time.`)
  process.exit(1)
}

const buildId = await waitForBuild()

const versions = await request(
  'GET',
  `/v1/apps/${appId}/appStoreVersions?filter[platform]=IOS&filter[versionString]=${encodeURIComponent(marketingVersion)}&limit=1`,
)
let versionId = versions.data?.[0]?.id
if (!versionId) {
  const created = await request('POST', '/v1/appStoreVersions', {
    data: {
      type: 'appStoreVersions',
      attributes: { platform: 'IOS', versionString: marketingVersion },
      relationships: { app: { data: { type: 'apps', id: appId } } },
    },
  })
  versionId = created.data.id
}

await request('PATCH', `/v1/appStoreVersions/${versionId}/relationships/build`, {
  data: { type: 'builds', id: buildId },
})

const submission = await request('POST', '/v1/reviewSubmissions', {
  data: {
    type: 'reviewSubmissions',
    attributes: { platform: 'IOS' },
    relationships: { app: { data: { type: 'apps', id: appId } } },
  },
})
const submissionId = submission.data.id

await request('POST', '/v1/reviewSubmissionItems', {
  data: {
    type: 'reviewSubmissionItems',
    relationships: {
      reviewSubmission: { data: { type: 'reviewSubmissions', id: submissionId } },
      appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } },
    },
  },
})

await request('PATCH', `/v1/reviewSubmissions/${submissionId}`, {
  data: {
    type: 'reviewSubmissions',
    id: submissionId,
    attributes: { submitted: true },
  },
})

console.log(`Submitted ${marketingVersion} (${buildNumber}) for App Store review.`)
