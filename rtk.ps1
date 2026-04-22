param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Args
)

if (-not $Args -or $Args.Count -eq 0) {
  exit 0
}

$command = $Args[0]
if ($Args.Count -gt 1) {
  $rest = $Args[1..($Args.Count - 1)]
  & $command @rest
} else {
  & $command
}

