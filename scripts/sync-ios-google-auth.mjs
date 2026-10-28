import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env.ios')
const requireEnv = process.argv.includes('--require') || process.env.CI === 'true'

let iosClientId = process.env.VITE_GOOGLE_IOS_CLIENT_ID?.trim() || ''

try {
  const envText = readFileSync(envPath, 'utf8')
  const match = envText.match(/^VITE_GOOGLE_IOS_CLIENT_ID=(.+)$/m)
  if (match?.[1] && !match[1].startsWith('#')) {
    iosClientId = match[1].trim()
  }
} catch {
  /* optional locally */
}

if (!iosClientId) {
  const message =
    '[sync-ios-google-auth] VITE_GOOGLE_IOS_CLIENT_ID ausente (env ou .env.ios). Sem ele o URL scheme REVERSED_CLIENT_ID nao e escrito e o login Google no iOS falha.'
  if (requireEnv) {
    console.error(message)
    process.exit(1)
  }
  console.warn(message)
  process.exit(0)
}

if (!iosClientId.endsWith('.apps.googleusercontent.com')) {
  console.error(
    `[sync-ios-google-auth] VITE_GOOGLE_IOS_CLIENT_ID invalido: esperado *.apps.googleusercontent.com, recebido "${iosClientId}"`,
  )
  process.exit(1)
}

const reversed = iosClientId.split('.').reverse().join('.')
const plistPath = join(root, 'mobile/ios/App/App/Info.plist')
if (!existsSync(plistPath)) {
  console.error('[sync-ios-google-auth] Info.plist ainda nao existe. Rode npx cap add ios.')
  process.exit(1)
}

let plist = readFileSync(plistPath, 'utf8')
const googleUrlType = `		<dict>
			<key>CFBundleURLName</key>
			<string>GoogleSignIn</string>
			<key>CFBundleURLSchemes</key>
			<array>
				<string>${reversed}</string>
			</array>
		</dict>`

if (plist.includes('GoogleSignIn')) {
  plist = plist.replace(
    /<key>CFBundleURLName<\/key>\s*<string>GoogleSignIn<\/string>\s*<key>CFBundleURLSchemes<\/key>\s*<array>\s*<string>[^<]*<\/string>\s*<\/array>/,
    `<key>CFBundleURLName</key>
			<string>GoogleSignIn</string>
			<key>CFBundleURLSchemes</key>
			<array>
				<string>${reversed}</string>
			</array>`,
  )
} else if (plist.includes('<key>CFBundleURLTypes</key>')) {
  plist = plist.replace(
    '<key>CFBundleURLTypes</key>\n	<array>',
    `<key>CFBundleURLTypes</key>\n	<array>\n${googleUrlType}`,
  )
} else {
  plist = plist.replace(
    '</dict>\n</plist>',
    `\t<key>CFBundleURLTypes</key>\n\t<array>\n${googleUrlType}\n\t</array>\n</dict>\n</plist>`,
  )
}

if (plist.includes('<key>GIDClientID</key>')) {
  plist = plist.replace(
    /<key>GIDClientID<\/key>\s*<string>[^<]*<\/string>/,
    `<key>GIDClientID</key>\n\t<string>${iosClientId}</string>`,
  )
} else {
  plist = plist.replace(
    '</dict>\n</plist>',
    `\t<key>GIDClientID</key>\n\t<string>${iosClientId}</string>\n</dict>\n</plist>`,
  )
}

writeFileSync(plistPath, plist)

if (!plist.includes(reversed) || !plist.includes(iosClientId)) {
  console.error('[sync-ios-google-auth] Info.plist nao contem REVERSED_CLIENT_ID ou GIDClientID apos escrita.')
  process.exit(1)
}

console.log(`[sync-ios-google-auth] Info.plist OK (GIDClientID + URL scheme ${reversed})`)

const googleServicePath = join(root, 'mobile/ios/App/App/GoogleService-Info.plist')
if (existsSync(googleServicePath)) {
  let googleService = readFileSync(googleServicePath, 'utf8')
  googleService = googleService.replace(
    /(<key>CLIENT_ID<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${iosClientId}$2`,
  )
  googleService = googleService.replace(
    /(<key>REVERSED_CLIENT_ID<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${reversed}$2`,
  )
  googleService = googleService.replace(
    /(<key>BUNDLE_ID<\/key>\s*<string>)[^<]*(<\/string>)/,
    '$1br.com.conora.app$2',
  )
  writeFileSync(googleServicePath, googleService)
  console.log('[sync-ios-google-auth] GoogleService-Info.plist sincronizado')
}
