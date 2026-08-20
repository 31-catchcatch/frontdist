$ErrorActionPreference = "Stop"
$htmlDir = "C:\nginx\html"
$backupDir = "C:\Users\Catchcatch31admin\deploy_temp\html_backup_" + (Get-Date -Format yyyyMMdd_HHmmss)
$tempDir = "C:\Users\Catchcatch31admin\deploy_temp"

Write-Output "=== Backup ==="
Copy-Item -Path $htmlDir -Destination $backupDir -Recurse -Force

Write-Output "=== Extract ==="
New-Item -ItemType Directory -Force -Path "$tempDir\extracted"
tar -xzf "$tempDir\frontdist.tar.gz" -C "$tempDir\extracted"

Write-Output "=== Replace ==="
Get-ChildItem -Path $htmlDir | Remove-Item -Recurse -Force
Copy-Item -Path "$tempDir\extracted\*" -Destination $htmlDir -Recurse -Force

Write-Output "=== Clean ==="
Remove-Item -Path "$htmlDir\.gitignore" -ErrorAction SilentlyContinue
Remove-Item -Path "$htmlDir\README.md" -ErrorAction SilentlyContinue
Remove-Item -Path "$htmlDir\_template.html" -ErrorAction SilentlyContinue
Remove-Item -Path "$htmlDir\tunnel.log" -ErrorAction SilentlyContinue

Write-Output "=== Nginx Restart ==="
Restart-Service nginx
Start-Sleep -Seconds 3

Write-Output "=== Health Check ==="
$response = Invoke-WebRequest -Uri "http://localhost" -UseBasicParsing -TimeoutSec 10
if ($response.StatusCode -eq 200) {
    Write-Output "Deploy Success: 200 OK"
} else {
    throw "Health check failed"
}

Write-Output "=== Cleanup ==="
Remove-Item -Path "$tempDir\frontdist.tar.gz" -Force
Remove-Item -Path "$tempDir\extracted" -Recurse -Force
