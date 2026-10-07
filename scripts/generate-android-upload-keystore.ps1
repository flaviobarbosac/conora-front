# Generates upload keystore + keystore.properties (gitignored). Run once per machine/org.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$keytool = "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"
if (-not (Test-Path $keytool)) {
  throw "keytool not found. Install Android Studio JBR."
}

$keystorePath = Join-Path $root "conora-upload.keystore"
$propsPath = Join-Path $root "mobile\android\keystore.properties"
$fingerprintsPath = Join-Path $root "mobile\android\release-signing-fingerprints.txt"

if (Test-Path $keystorePath) {
  Write-Host "Keystore already exists: $keystorePath"
  exit 0
}

function New-RandomPassword([int]$Length = 32) {
  $chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  -join (1..$Length | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
}

$storePass = New-RandomPassword
$keyPass = $storePass
$alias = "conora"
$dname = "CN=Conora, OU=Mobile, O=RedFive, L=Alfredo Chaves, ST=ES, C=BR"

& $keytool -genkeypair -v `
  -keystore $keystorePath `
  -alias $alias `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -storepass $storePass -keypass $keyPass `
  -dname $dname

$props = @"
storeFile=../../../conora-upload.keystore
storePassword=$storePass
keyAlias=$alias
keyPassword=$keyPass
"@
[System.IO.File]::WriteAllText($propsPath, $props)

$listing = & $keytool -list -v -keystore $keystorePath -alias $alias -storepass $storePass 2>&1 | Out-String
$sha1 = if ($listing -match 'SHA-?1:\s*([A-F0-9:]+)') { $Matches[1] } else { 'N/A' }
$sha256 = if ($listing -match 'SHA-?256:\s*([A-F0-9:]+)') { $Matches[1] } else { 'N/A' }

$fpDoc = @"
Conora Android upload keystore fingerprints (release)
Generated: $(Get-Date -Format o)
Package: br.com.conora.app
Alias: $alias

SHA-1:   $sha1
SHA-256: $sha256
"@
[System.IO.File]::WriteAllText($fingerprintsPath, $fpDoc)
Write-Host $fpDoc
