<#
.SYNOPSIS
  Stores the GitHub secrets used by .github/workflows/android-play.yml.

.DESCRIPTION
  Reads the upload keystore, mobile/android/keystore.properties and the Play service
  account JSON from this checkout and writes them to the conora-front repository secrets.
  Values are never printed.

.EXAMPLE
  .\scripts\set-android-play-secrets.ps1
  .\scripts\set-android-play-secrets.ps1 -ServiceAccountFile C:\keys\play-publisher.json
#>
param(
    [string]$KeystoreFile = (Join-Path $PSScriptRoot '..\conora-upload.keystore'),
    [string]$KeystoreProperties = (Join-Path $PSScriptRoot '..\mobile\android\keystore.properties'),
    [string]$ServiceAccountFile = (Join-Path $PSScriptRoot '..\mobile\android\play-service-account.json'),
    [string]$Repo = 'flaviobarbosac/conora-front'
)

$ErrorActionPreference = 'Stop'

foreach ($f in @($KeystoreFile, $KeystoreProperties, $ServiceAccountFile)) {
    if (-not (Test-Path $f)) { throw "File not found: $f" }
}

$props = @{}
Get-Content $KeystoreProperties | ForEach-Object {
    if ($_ -match '^\s*([^#=]+?)\s*=\s*(.*)$') { $props[$Matches[1]] = $Matches[2].Trim() }
}
foreach ($k in @('storePassword', 'keyAlias', 'keyPassword')) {
    if (-not $props[$k]) { throw "Missing $k in $KeystoreProperties" }
}

$secrets = [ordered]@{
    ANDROID_KEYSTORE_BASE64   = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path $KeystoreFile)))
    ANDROID_KEYSTORE_PASSWORD = $props['storePassword']
    ANDROID_KEY_ALIAS         = $props['keyAlias']
    ANDROID_KEY_PASSWORD      = $props['keyPassword']
    PLAY_SERVICE_ACCOUNT_JSON = [IO.File]::ReadAllText((Resolve-Path $ServiceAccountFile))
}

foreach ($name in $secrets.Keys) {
    $secrets[$name] | gh secret set $name --repo $Repo
    if ($LASTEXITCODE -ne 0) { throw "Could not set $name" }
    Write-Host "Set $name"
}

$email = ($secrets['PLAY_SERVICE_ACCOUNT_JSON'] | ConvertFrom-Json).client_email
Write-Host "Done. The service account $email must be invited in Play Console with release permissions on Conora." -ForegroundColor Green
