param(
  [string]$Message = "Update Website 5"
)

$ErrorActionPreference = "Stop"

Set-Location -LiteralPath $PSScriptRoot

Write-Host "Website 5 deploy helper"
Write-Host "Repo: $PSScriptRoot"
Write-Host ""

git status --short
Write-Host ""

git add .

$pendingChanges = git diff --cached --name-only
if (-not $pendingChanges) {
  Write-Host "No staged changes to commit."
} else {
  git commit -m $Message
}

git push

Write-Host ""
Write-Host "Pushed to GitHub. Cloudflare should start its connected build automatically."
Write-Host "Check Cloudflare Workers Builds for the awomanwithawelder deployment log."
