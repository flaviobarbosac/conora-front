import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = join(root, 'mobile/android/app/src/main/AndroidManifest.xml')
if (!existsSync(manifestPath)) {
  console.warn('[patch-android-share-intent] AndroidManifest ainda nao existe.')
  process.exit(0)
}

let xml = readFileSync(manifestPath, 'utf8')

if (!xml.includes('android.intent.action.SEND')) {
  xml = xml.replace(
    '</activity>',
    `            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="image/*" />
            </intent-filter>

        </activity>`,
  )
}

if (!xml.includes('android.permission.CAMERA')) {
  xml = xml.replace(
    '</manifest>',
    `    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
</manifest>`,
  )
}

if (!xml.includes('android:scheme="conora"')) {
  xml = xml.replace(
    '</activity>',
    `            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="conora" />
            </intent-filter>

        </activity>`,
  )
}

if (!xml.includes('usesCleartextTraffic')) {
  xml = xml.replace('<application', '<application android:usesCleartextTraffic="true"')
}

writeFileSync(manifestPath, xml)
console.log('[patch-android-share-intent] Manifest atualizado')
