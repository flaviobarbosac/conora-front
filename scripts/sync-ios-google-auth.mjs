import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env.ios')

let iosClientId = process.env.VITE_GOOGLE_IOS_CLIENT_ID?.trim() || ''

try {
  const envText = readFileSync(envPath, 'utf8')
  const match = envText.match(/^VITE_GOOGLE_IOS_CLIENT_ID=(.+)$/m)
  if (match?.[1] && !match[1].startsWith('#')) {
    iosClientId = match[1].trim()
  }
} catch {
  /* optional */
}

if (!iosClientId) {
  console.warn('[sync-ios-google-auth] VITE_GOOGLE_IOS_CLIENT_ID ausente em .env.ios')
  process.exit(0)
}

const reversed = iosClientId.split('.').reverse().join('.')
const plistPath = join(root, 'mobile/ios/App/App/Info.plist')
if (!existsSync(plistPath)) {
  console.warn('[sync-ios-google-auth] Info.plist ainda nao existe. Rode npx cap add ios.')
  process.exit(0)
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
  plist = plist.replace('<key>CFBundleURLTypes</key>\n	<array>', `<key>CFBundleURLTypes</key>\n	<array>\n${googleUrlType}`)
} else {
  plist = plist.replace('</dict>\n</plist>', `\t<key>CFBundleURLTypes</key>\n\t<array>\n${googleUrlType}\n\t</array>\n</dict>\n</plist>`)
}

if (!plist.includes('GIDClientID')) {
  plist = plist.replace(
    '</dict>\n</plist>',
    `\t<key>GIDClientID</key>\n\t<string>${iosClientId}</string>\n</dict>\n</plist>`,
  )
}

writeFileSync(plistPath, plist)
console.log('[sync-ios-google-auth] Info.plist atualizado')
