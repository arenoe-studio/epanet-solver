param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $Args
)

$ErrorActionPreference = 'Stop'

if (-not $Args -or $Args.Count -eq 0) {
  Write-Error "Usage: rtk <command> [args...]"
}

$cmd = $Args[0]
$rest = @()
if ($Args.Count -gt 1) { $rest = $Args[1..($Args.Count - 1)] }

function Invoke-Passthrough([string[]] $argv) {
  $exe = $argv[0]
  $a = @()
  if ($argv.Count -gt 1) { $a = $argv[1..($argv.Count - 1)] }
  & $exe @a
  exit $LASTEXITCODE
}

switch ($cmd) {
  'ls' {
    # `rtk ls [path]` -> tree-ish but minimal; keep it simple.
    $path = '.'
    if ($rest.Count -ge 1 -and $rest[0]) { $path = $rest[0] }
    Get-ChildItem -Force -Path $path
    break
  }
  'read' {
    if ($rest.Count -lt 1) { Write-Error "Usage: rtk read <file>" }
    Get-Content -LiteralPath $rest[0]
    break
  }
  'grep' {
    if ($rest.Count -lt 1) { Write-Error "Usage: rtk grep <pattern> [path]" }
    $pattern = $rest[0]
    $path = '.'
    if ($rest.Count -ge 2 -and $rest[1]) { $path = $rest[1] }
    $rg = Get-Command rg -ErrorAction SilentlyContinue
    if ($null -ne $rg) {
      & $rg.Source $pattern $path `
        --hidden `
        --no-ignore-vcs `
        --glob '!.git/**' `
        --glob '!node_modules/**' `
        --glob '!.next/**' `
        --glob '!dist/**' `
        --glob '!build/**' `
        --glob '!coverage/**' `
        --glob '!**/*.lock' `
        --glob '!**/*.tsbuildinfo'
      exit $LASTEXITCODE
    }
    Get-ChildItem -Recurse -File -Force -Path $path -Exclude @('package-lock.json','tsconfig.tsbuildinfo') |
      Where-Object {
        $_.FullName -notmatch '\\node_modules\\' -and
        $_.FullName -notmatch '\\\.git\\' -and
        $_.FullName -notmatch '\\\.next\\'
      } |
      Select-String -Pattern $pattern -List:$false
    break
  }
  'find' {
    if ($rest.Count -lt 1) { Write-Error "Usage: rtk find <pattern> [path]" }
    $pattern = $rest[0]
    $path = '.'
    if ($rest.Count -ge 2 -and $rest[1]) { $path = $rest[1] }
    Get-ChildItem -Recurse -Force -Path $path -Filter $pattern |
      Where-Object {
        $_.FullName -notmatch '\\node_modules\\' -and
        $_.FullName -notmatch '\\\.git\\' -and
        $_.FullName -notmatch '\\\.next\\'
      }
    break
  }
  default {
    Invoke-Passthrough -argv $Args
  }
}
