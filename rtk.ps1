#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-RtkCommand {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $Args
  )

  if (-not $Args -or $Args.Count -eq 0) {
    throw "Usage: rtk <command> [args...]"
  }

  $cmd = $Args[0]
  $rest = @()
  if ($Args.Count -gt 1) { $rest = $Args[1..($Args.Count - 1)] }

  switch ($cmd) {
    'ls' {
      $path = if ($rest.Count -gt 0) { $rest[0] } else { '.' }
      Get-ChildItem -Force -LiteralPath $path
      return
    }
    'read' {
      if ($rest.Count -lt 1) { throw "Usage: rtk read <file>" }
      $path = $rest[0]
      if (-not (Test-Path -LiteralPath $path)) { throw "File not found: $path" }

      $lines = Get-Content -LiteralPath $path -ErrorAction Stop
      $max = 260
      $i = 1
      foreach ($line in $lines) {
        if ($i -gt $max) {
          Write-Output "... (truncated; showing first $max lines)"
          break
        }
        "{0,4}: {1}" -f $i, $line
        $i++
      }
      return
    }
    'grep' {
      if ($rest.Count -lt 1) { throw "Usage: rtk grep <pattern> [path]" }
      $pattern = $rest[0]
      $path = if ($rest.Count -gt 1) { $rest[1] } else { '.' }
      if (Get-Command rg -ErrorAction SilentlyContinue) {
        & rg $pattern $path
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        return
      }
      Get-ChildItem -Recurse -File -Force -LiteralPath $path |
        Select-String -Pattern $pattern
      return
    }
    'find' {
      if ($rest.Count -lt 1) { throw "Usage: rtk find <pattern> [path]" }
      $pattern = $rest[0]
      $path = if ($rest.Count -gt 1) { $rest[1] } else { '.' }
      Get-ChildItem -Recurse -Force -LiteralPath $path |
        Where-Object { $_.Name -like "*$pattern*" } |
        ForEach-Object { $_.FullName }
      return
    }
    'test' {
      if ($rest.Count -lt 1) { throw "Usage: rtk test <cmd> [args...]" }
      $exec = $rest[0]
      $execArgs = @()
      if ($rest.Count -gt 1) { $execArgs = $rest[1..($rest.Count - 1)] }
      & $exec @execArgs
      if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
      return
    }
    default {
      & $cmd @rest
      if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
      return
    }
  }
}

Invoke-RtkCommand @Args

