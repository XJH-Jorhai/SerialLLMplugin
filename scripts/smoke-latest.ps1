[CmdletBinding()]
param(
  [string]$BridgeHost = "127.0.0.1",
  [int]$Port = 8765,
  [int]$Seconds = 20
)

$ErrorActionPreference = "Stop"

$baseUrl = "http://${BridgeHost}:$Port"

try {
  $session = Invoke-RestMethod -Method Get -Uri "$baseUrl/session"
  $latest = Invoke-RestMethod -Method Get -Uri "$baseUrl/latest?seconds=$Seconds"

  Write-Host "GET /session"
  $session | ConvertTo-Json -Depth 20
  Write-Host ""
  Write-Host "GET /latest?seconds=$Seconds"
  $latest | ConvertTo-Json -Depth 20
} catch {
  Write-Error "MCU Serial Bridge smoke check failed: $($_.Exception.Message)"
  exit 1
}
