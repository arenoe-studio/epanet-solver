$ErrorActionPreference = "Stop"

function Invoke-Passthrough {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest
  )

  & $Command @Rest
  exit $LASTEXITCODE
}

if ($args.Count -eq 0) {
  Write-Error "Usage: rtk <command> [args...]"
}

$sub = $args[0]
$rest = @()
if ($args.Count -gt 1) { $rest = $args[1..($args.Count - 1)] }

switch ($sub) {
  "ls" {
    $path = if ($rest.Count -gt 0) { $rest[0] } else { "." }
    Get-ChildItem -Force $path | Format-Table -AutoSize
    break
  }
  "read" {
    if ($rest.Count -lt 1) { Write-Error "Usage: rtk read <file>" }
    Get-Content -LiteralPath $rest[0]
    break
  }
  "grep" {
    if ($rest.Count -lt 1) { Write-Error "Usage: rtk grep <pattern> [path]" }
    $pattern = $rest[0]
    $path = if ($rest.Count -gt 1) { $rest[1] } else { "." }
    if (Get-Command rg -ErrorAction SilentlyContinue) {
      & rg $pattern $path
      exit $LASTEXITCODE
    }
    Get-ChildItem -Path $path -Recurse -File -ErrorAction SilentlyContinue |
      Select-String -Pattern $pattern -SimpleMatch
    break
  }
  "find" {
    if ($rest.Count -lt 1) { Write-Error "Usage: rtk find <pattern> [path]" }
    $pattern = $rest[0]
    $path = if ($rest.Count -gt 1) { $rest[1] } else { "." }
    Get-ChildItem -Path $path -Recurse -Force -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -like "*$pattern*" } |
      ForEach-Object { $_.FullName }
    break
  }
  "test" {
    if ($rest.Count -lt 1) { Write-Error "Usage: rtk test <cmd> [args...]" }
    Invoke-Passthrough -Command $rest[0] -Rest $rest[1..($rest.Count - 1)]
    break
  }
  default {
    Invoke-Passthrough -Command $sub -Rest $rest
  }
}

