import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const mode = process.argv.includes('--mode')
  ? process.argv[process.argv.indexOf('--mode') + 1]
  : 'android'

const envPath = mode === 'android' ? join(root, '.env.android') : join(root, `.env.${mode}`)

let clientId = process.env.VITE_GOOGLE_CLIENT_ID?.trim() || ''

try {
  const envText = readFileSync(envPath, 'utf8')
  const match = envText.match(/^VITE_GOOGLE_CLIENT_ID=(.+)$/m)
  if (match?.[1] && !match[1].startsWith('#')) {
    clientId = match[1].trim()
  }
} catch {
  /* optional */
}

const stringsPath = join(root, 'mobile/android/app/src/main/res/values/strings.xml')
if (!existsSync(stringsPath)) {
  console.warn('[sync-android-google-auth] strings.xml ainda nao existe. Rode npx cap add android.')
  process.exit(0)
}

let xml = readFileSync(stringsPath, 'utf8')
if (!xml.includes('server_client_id')) {
  xml = xml.replace('</resources>', `    <string name="server_client_id">${clientId}</string>\n</resources>`)
} else {
  xml = xml.replace(
    /<string name="server_client_id">[^<]*<\/string>/,
    `<string name="server_client_id">${clientId}</string>`,
  )
}
writeFileSync(stringsPath, xml)
console.log(`[sync-android-google-auth] server_client_id atualizado`)
