$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$portOpen = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue

if (-not $portOpen) {
    Start-Process python -ArgumentList "scripts/fund_web_server.py" -WorkingDirectory $root -WindowStyle Hidden | Out-Null

    for ($i = 0; $i -lt 8; $i++) {
        Start-Sleep -Seconds 1
        $portOpen = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue
        if ($portOpen) {
            break
        }
    }
}

Start-Process "http://127.0.0.1:8765/" | Out-Null
