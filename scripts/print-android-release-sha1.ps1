$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$keytool = "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"
$propsPath = Join-Path $root "mobile\android\keystore.properties"

if (-not (Test-Path $propsPath)) {
  throw "Missing $propsPath - run npm run android:keystore first."
}

$props = @{}
Get-Content $propsPath | ForEach-Object {
  if ($_ -match '^([^#=]+)=(.*)$') { $props[$Matches[1].Trim()] = $Matches[2].Trim() }
}
$appDir = Join-Path $root "mobile\android\app"
$storeFile = Join-Path $appDir $props.storeFile
if (-not (Test-Path $storeFile)) {
  $storeFile = Join-Path $root "conora-upload.keystore"
}
if (-not (Test-Path $storeFile)) {
  throw "Keystore not found at $storeFile"
}

& $keytool -list -v -keystore $storeFile -alias $props.keyAlias -storepass $props.storePassword
