/**
 * Enables Associated Domains on br.com.conora.app and recreates the
 * "Conora App Store" provisioning profile. Writes profile.mobileprovision
 * and profile.b64 next to the script (or OUT_DIR).
 *
 * Env: APP_STORE_CONNECT_API_KEY_ID, APP_STORE_CONNECT_ISSUER_ID,
 *      APP_STORE_CONNECT_API_KEY_PATH (or APP_STORE_CONNECT_API_KEY_BASE64)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { sign } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const api = 'https://api.appstoreconnect.apple.com'
const bundleId = 'br.com.conora.app'
const profileName = 'Conora App Store'
const keyId = process.env.APP_STORE_CONNECT_API_KEY_ID
const issuerId = process.env.APP_STORE_CONNECT_ISSUER_ID
const keyPath = process.env.APP_STORE_CONNECT_API_KEY_PATH
const keyB64 = process.env.APP_STORE_CONNECT_API_KEY_BASE64
const outDir = process.env.OUT_DIR || join(dirname(fileURLToPath(import.meta.url)), '..', 'tmp-ios-profile')

if (!keyId || !issuerId || (!keyPath && !keyB64)) {
  console.error('Missing App Store Connect API credentials.')
  process.exit(1)
}

const privateKey = keyB64
  ? Buffer.from(keyB64, 'base64').toString('utf8')
  : readFileSync(keyPath, 'utf8')

function token() {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(
    JSON.stringify({
      iss: issuerId,
      iat: now,
      exp: now + 19 * 60,
      aud: 'appstoreconnect-v1',
    }),
  ).toString('base64url')
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
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  const json = text ? JSON.parse(text) : {}
  if (!response.ok) {
    const err = new Error(`${method} ${path} -> ${response.status}: ${text}`)
    err.status = response.status
    err.json = json
    throw err
  }
  return json
}

async function main() {
  mkdirSync(outDir, { recursive: true })

  const bundles = await request(
    'GET',
    `/v1/bundleIds?filter[identifier]=${encodeURIComponent(bundleId)}&limit=10`,
  )
  const bundle = bundles.data?.[0]
  if (!bundle) throw new Error(`Bundle ID ${bundleId} not found`)
  console.log(`Bundle: ${bundle.id} (${bundle.attributes.identifier})`)

  const caps = await request('GET', `/v1/bundleIds/${bundle.id}/bundleIdCapabilities?limit=200`)
  const hasAssociated = (caps.data || []).some((c) => c.attributes?.capabilityType === 'ASSOCIATED_DOMAINS')
  if (hasAssociated) {
    console.log('ASSOCIATED_DOMAINS already enabled')
  } else {
    console.log('Enabling ASSOCIATED_DOMAINS…')
    try {
      await request('POST', '/v1/bundleIdCapabilities', {
        data: {
          type: 'bundleIdCapabilities',
          attributes: { capabilityType: 'ASSOCIATED_DOMAINS' },
          relationships: {
            bundleId: { data: { type: 'bundleIds', id: bundle.id } },
          },
        },
      })
      console.log('ASSOCIATED_DOMAINS enabled')
    } catch (e) {
      // Already present under another shape
      if (e.status === 409) console.log('ASSOCIATED_DOMAINS already present (409)')
      else throw e
    }
  }

  const profiles = await request(
    'GET',
    `/v1/profiles?filter[name]=${encodeURIComponent(profileName)}&filter[profileType]=IOS_APP_STORE&limit=20`,
  )
  for (const p of profiles.data || []) {
    console.log(`Deleting old profile ${p.id} (${p.attributes.name})…`)
    await request('DELETE', `/v1/profiles/${p.id}`)
  }

  const certs = await request(
    'GET',
    '/v1/certificates?filter[certificateType]=DISTRIBUTION&limit=50',
  )
  const distCerts = (certs.data || []).filter((c) =>
    ['IOS_DISTRIBUTION', 'DISTRIBUTION', 'APPLE_DISTRIBUTION'].includes(c.attributes.certificateType),
  )
  if (!distCerts.length) throw new Error('No iOS distribution certificate found')
  console.log(`Using distribution cert ${distCerts[0].id} (${distCerts[0].attributes.certificateType})`)

  console.log(`Creating profile "${profileName}"…`)
  const created = await request('POST', '/v1/profiles', {
    data: {
      type: 'profiles',
      attributes: {
        name: profileName,
        profileType: 'IOS_APP_STORE',
      },
      relationships: {
        bundleId: { data: { type: 'bundleIds', id: bundle.id } },
        certificates: {
          data: distCerts.map((c) => ({ type: 'certificates', id: c.id })),
        },
      },
    },
  })

  const profileContent = created.data?.attributes?.profileContent
  if (!profileContent) throw new Error('Profile created but profileContent missing')
  const binary = Buffer.from(profileContent, 'base64')
  const profilePath = join(outDir, 'Conora_App_Store.mobileprovision')
  const b64Path = join(outDir, 'profile.b64')
  writeFileSync(profilePath, binary)
  writeFileSync(b64Path, binary.toString('base64'))
  console.log(`Wrote ${profilePath}`)
  console.log(`Wrote ${b64Path}`)
  console.log(`UUID=${created.data.attributes.uuid}`)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
