[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Data,
  [string]$BridgeHost = "127.0.0.1",
  [int]$Port = 8765
)

$ErrorActionPreference = "Stop"

$baseUrl = "http://${BridgeHost}:$Port"
$body = @{
  data = $Data
  encoding = "text"
} | ConvertTo-Json

try {
  Invoke-RestMethod `
    -Method Post `
    -Uri "$baseUrl/serial/send" `
    -ContentType "application/json" `
    -Body $body
} catch {
  Write-Error "MCU Serial Bridge command send failed: $($_.Exception.Message)"
  exit 1
}
