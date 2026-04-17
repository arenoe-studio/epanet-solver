param(
  [Parameter(Mandatory = $false)]
  [string]$EnvFile = ".env.vercel",

  [Parameter(Mandatory = $false)]
  [ValidateSet("production", "preview", "development")]
  [string]$Environment = "production",

  [Parameter(Mandatory = $false)]
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Parse-EnvFile([string]$Path) {
  if (!(Test-Path -LiteralPath $Path)) {
    throw "Env file not found: $Path. Copy .env.vercel.example -> .env.vercel and fill values."
  }

  $pairs = @()
  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line.Length -eq 0) { return }
    if ($line.StartsWith("#")) { return }

    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }

    $name = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1)

    if ($value.StartsWith('"') -and $value.EndsWith('"') -and $value.Length -ge 2) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    if ($name.Length -eq 0) { return }
    $pairs += [pscustomobject]@{ Name = $name; Value = $value }
  }

  return $pairs
}

$pairs = Parse-EnvFile $EnvFile
if ($pairs.Count -eq 0) {
  throw "No env vars found in $EnvFile"
}

Write-Host "Pushing $($pairs.Count) env vars from $EnvFile to Vercel environment '$Environment'..."
Write-Host "Notes: requires Vercel CLI login and a linked project (run: npx -y vercel link)."

foreach ($p in $pairs) {
  if ($DryRun) {
    Write-Host "[DryRun] $($p.Name)=<hidden> -> $Environment"
    continue
  }

  # Push value via stdin so you don't need to re-type.
  # If a variable already exists, Vercel CLI may prompt; re-run with manual confirmation if needed.
  $p.Value | npx -y vercel env add $p.Name $Environment --yes | Out-Host
}

Write-Host "Done."

