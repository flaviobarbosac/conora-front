<#
.SYNOPSIS
  Publishes the Conora Android app to Google Play from what is on main.

.DESCRIPTION
  Every merged develop -> main PR already publishes Android and iOS to production by itself.
  This script is for publishing on request: it triggers the "Android Google Play" workflow
  (.github/workflows/android-play.yml) on main and waits for it. Default track is production
  (Brasil, full rollout, sent for review). If develop has commits that are not on main, it
  stops and lists them, unless -MergeDevelop is passed: then it opens/merges the
  develop -> main PR (which publishes web, Android and iOS) and watches the Android run.

.EXAMPLE
  .\scripts\publish-android.ps1
  .\scripts\publish-android.ps1 -Notes "Novo resumo mensal."
  .\scripts\publish-android.ps1 -Track internal
  .\scripts\publish-android.ps1 -MergeDevelop
#>
param(
    [ValidateSet('production', 'internal')]
    [string]$Track = 'production',
    [string]$Notes = 'Melhorias e correções.',
    [switch]$MergeDevelop
)

$ErrorActionPreference = 'Stop'
$Repo = 'flaviobarbosac/conora-front'
$Workflow = 'android-play.yml'

gh auth status *> $null
if ($LASTEXITCODE -ne 0) { throw 'GitHub CLI is not logged in. Run: gh auth login' }

$before = gh run list --repo $Repo --workflow $Workflow --limit 1 --json databaseId --jq '.[0].databaseId'
$merged = $false

# Commits on develop that main does not have yet.
$ahead = gh api "repos/$Repo/compare/main...develop" --jq '.commits[] | .sha[0:7] + " " + (.commit.message | split("\n")[0])'
if ($ahead) {
    Write-Host 'develop has commits that are not on main:' -ForegroundColor Yellow
    $ahead | ForEach-Object { Write-Host "  $_" }
    if (-not $MergeDevelop) {
        throw 'Publishing builds main. Re-run with -MergeDevelop to merge develop into main first.'
    }
    $pr = gh pr list --repo $Repo --base main --head develop --state open --json number --jq '.[0].number'
    if (-not $pr) {
        $url = gh pr create --repo $Repo --base main --head develop --title 'release: develop -> main' --body 'Release for Android publication.'
        $pr = ($url -split '/')[-1]
    }
    Write-Host "Merging PR #$pr (develop -> main)..." -ForegroundColor Cyan
    gh pr merge $pr --repo $Repo --merge
    if ($LASTEXITCODE -ne 0) { throw "Could not merge PR #$pr. Check required checks/conflicts (package.json version must be above main)." }
    $merged = $true
}

$version = gh api "repos/$Repo/contents/package.json?ref=main" --jq '.content' |
    ForEach-Object { [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($_ -replace '\s', ''))) } |
    ConvertFrom-Json | Select-Object -ExpandProperty version

if ($merged) {
    # The develop -> main merge itself starts the production publication (Android and iOS).
    $Track = 'production'
    Write-Host "Merge started the production publication of Conora $version (Android and iOS)." -ForegroundColor Cyan
} else {
    Write-Host "Publishing Conora $version (main) to Google Play track '$Track'..." -ForegroundColor Cyan
    gh workflow run $Workflow --repo $Repo --ref main -f "track=$Track" -f "release_notes=$Notes"
    if ($LASTEXITCODE -ne 0) { throw 'Could not start the workflow.' }
}

# Wait for the new run to show up.
$runId = $null
for ($i = 0; $i -lt 30 -and -not $runId; $i++) {
    Start-Sleep -Seconds 3
    $latest = gh run list --repo $Repo --workflow $Workflow --limit 1 --json databaseId --jq '.[0].databaseId'
    if ($latest -and $latest -ne $before) { $runId = $latest }
}
if (-not $runId) { throw 'Workflow run did not start. Check GitHub Actions.' }

Write-Host "Run: https://github.com/$Repo/actions/runs/$runId"
gh run watch $runId --repo $Repo --exit-status
if ($LASTEXITCODE -ne 0) { throw "Publication failed. Logs: gh run view $runId --repo $Repo --log-failed" }

if ($Track -eq 'production') {
    Write-Host "Conora $version sent to Google Play production (Brasil). It goes live when Google approves the review." -ForegroundColor Green
} else {
    Write-Host "Conora $version available on internal testing." -ForegroundColor Green
}
