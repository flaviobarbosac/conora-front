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

// Like request(), but returns null instead of exiting (for optional steps).
async function tryRequest(method, path, body) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  if (!response.ok) {
    console.warn(`${method} ${path} skipped: ${response.status} ${text}`)
    return null
  }
  return text ? JSON.parse(text) : {}
}

// App Store allows a single editable version. Reuse the one with this version string,
// else rename the editable one (e.g. a rejected version), else create a new version.
const editableStates = [
  'PREPARE_FOR_SUBMISSION',
  'DEVELOPER_REJECTED',
  'REJECTED',
  'METADATA_REJECTED',
  'INVALID_BINARY',
]
const versions = await request(
  'GET',
  `/v1/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=20`,
)
let version = versions.data?.find((v) => v.attributes.versionString === marketingVersion)
if (!version) {
  version = versions.data?.find((v) => editableStates.includes(v.attributes.appStoreState))
}
let versionId = version?.id

async function itemsOf(submissionId) {
  const page = await request('GET', `/v1/reviewSubmissions/${submissionId}/items?include=appStoreVersion&limit=50`)
  return page.data ?? []
}

// A version still inside a rejected submission cannot join another one.
const unresolved = await request(
  'GET',
  `/v1/reviewSubmissions?filter[app]=${appId}&filter[platform]=IOS&filter[state]=UNRESOLVED_ISSUES&limit=10`,
)
for (const s of versionId ? unresolved.data ?? [] : []) {
  const items = await itemsOf(s.id)
  if (items.some((i) => i.relationships?.appStoreVersion?.data?.id === versionId)) {
    console.error(
      `Version ${marketingVersion} is still in rejected submission ${s.id}. ` +
        'Resolve it in App Store Connect (App Review): reply to Apple or remove the version from it, then re-run.',
    )
    process.exit(1)
  }
}

if (versionId) {
  // Production: goes live by itself once Apple approves.
  await request('PATCH', `/v1/appStoreVersions/${versionId}`, {
    data: {
      type: 'appStoreVersions',
      id: versionId,
      attributes: { versionString: marketingVersion, releaseType: 'AFTER_APPROVAL' },
    },
  })
} else {
  const created = await request('POST', '/v1/appStoreVersions', {
    data: {
      type: 'appStoreVersions',
      attributes: { platform: 'IOS', versionString: marketingVersion, releaseType: 'AFTER_APPROVAL' },
      relationships: { app: { data: { type: 'apps', id: appId } } },
    },
  })
  versionId = created.data.id
}

await request('PATCH', `/v1/appStoreVersions/${versionId}/relationships/build`, {
  data: { type: 'builds', id: buildId },
})

// "What's New" is required on updates once a version is live; Apple refuses it before that.
const whatsNew = process.env.WHATS_NEW || 'Melhorias e correções.'
const localizations = await tryRequest('GET', `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`)
for (const loc of localizations?.data ?? []) {
  if (!loc.attributes.whatsNew) {
    await tryRequest('PATCH', `/v1/appStoreVersionLocalizations/${loc.id}`, {
      data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes: { whatsNew } },
    })
  }
}

// Reuse the open draft submission with the most items (it may already hold subscriptions), else create one.
const open = await request(
  'GET',
  `/v1/reviewSubmissions?filter[app]=${appId}&filter[platform]=IOS&filter[state]=READY_FOR_REVIEW&limit=10`,
)
let submissionId = null
let mostItems = -1
for (const s of open.data ?? []) {
  const count = (await itemsOf(s.id)).length
  if (count > mostItems) {
    mostItems = count
    submissionId = s.id
  }
}
if (!submissionId) {
  const submission = await request('POST', '/v1/reviewSubmissions', {
    data: {
      type: 'reviewSubmissions',
      attributes: { platform: 'IOS' },
      relationships: { app: { data: { type: 'apps', id: appId } } },
    },
  })
  submissionId = submission.data.id
}

const hasVersion = (await itemsOf(submissionId)).some((i) => i.relationships?.appStoreVersion?.data?.id === versionId)
if (!hasVersion) {
  await request('POST', '/v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: submissionId } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } },
      },
    },
  })
}

await request('PATCH', `/v1/reviewSubmissions/${submissionId}`, {
  data: {
    type: 'reviewSubmissions',
    id: submissionId,
    attributes: { submitted: true },
  },
})

console.log(`Submitted ${marketingVersion} (${buildNumber}) for App Store review; releases automatically after approval.`)
