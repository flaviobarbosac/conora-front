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

// The live app stays READY_FOR_SALE. An update reuses the single open version
// (prepare, rejected, or already waiting for review) and sets it to this release.
// Creating another version while one is open is what Apple rejects with 409.
const closedStates = new Set([
  'READY_FOR_SALE',
  'REPLACED_WITH_NEW_VERSION',
  'REMOVED_FROM_SALE',
  'DEVELOPER_REMOVED_FROM_SALE',
  'PREORDER_READY_FOR_SALE',
])
const versions = await request(
  'GET',
  `/v1/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=20`,
)
for (const item of versions.data ?? []) {
  console.log(`App Store ${item.attributes.versionString}: ${item.attributes.appStoreState}`)
}
const openVersions = (versions.data ?? []).filter((item) => !closedStates.has(item.attributes.appStoreState))
let version = openVersions.find((item) => item.attributes.versionString === marketingVersion) ?? openVersions[0]
let versionId = version?.id

async function submissionsIn(state) {
  const page = await request(
    'GET',
    `/v1/reviewSubmissions?filter[app]=${appId}&filter[platform]=IOS&filter[state]=${state}&limit=10`,
  )
  return page.data ?? []
}

if (version && ['WAITING_FOR_REVIEW', 'IN_REVIEW'].includes(version.attributes.appStoreState)) {
  const queued = [
    ...(await submissionsIn('WAITING_FOR_REVIEW')),
    ...(await submissionsIn('IN_REVIEW')),
  ]
  for (const submission of queued) {
    const items = await itemsOf(submission.id)
    if (!items.some((item) => item.relationships?.appStoreVersion?.data?.id === versionId)) continue
    if (submission.attributes.state !== 'WAITING_FOR_REVIEW') {
      console.error(
        `Version ${version.attributes.versionString} is already in review. ` +
          'Apple accepts the current update only after this review ends.',
      )
      process.exit(1)
    }
    console.log(`Canceling the review queued for ${version.attributes.versionString} so ${marketingVersion} can replace it.`)
    await request('DELETE', `/v1/reviewSubmissions/${submission.id}`)
  }
}

if (version && ['PENDING_DEVELOPER_RELEASE', 'PENDING_APPLE_RELEASE'].includes(version.attributes.appStoreState)) {
  if (version.attributes.versionString !== marketingVersion) {
    console.error(
      `Version ${version.attributes.versionString} is already approved and waiting to go live. ` +
        `Apple blocks ${marketingVersion} until that one is released.`,
    )
    process.exit(1)
  }
  if (version.attributes.appStoreState === 'PENDING_DEVELOPER_RELEASE') {
    await request('POST', '/v1/appStoreVersionReleaseRequests', {
      data: {
        type: 'appStoreVersionReleaseRequests',
        relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } } },
      },
    })
    console.log(`Released ${marketingVersion}. It was already approved.`)
    process.exit(0)
  }
}

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
  await tryRequest('PATCH', `/v1/appStoreVersionLocalizations/${loc.id}`, {
    data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes: { whatsNew } },
  })
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
