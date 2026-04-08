if (-not $env:LANGFUSE_PUBLIC_KEY -or -not $env:LANGFUSE_SECRET_KEY -or -not $env:LANGFUSE_HOST) {
  $env:OTEL_SDK_DISABLED = "true"
}

Set-Location "$PSScriptRoot\om-main\om-main\backend"
& "$PSScriptRoot\.venv\Scripts\python.exe" -m uvicorn main:app --reload
