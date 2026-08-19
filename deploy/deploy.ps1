$ErrorActionPreference = "Stop"
$htmlDir = "C:\nginx\html"
$backupDir = "C:\Users\Catchcatch31admin\deploy_temp\html_backup_" + (Get-Date -Format yyyyMMdd_HHmmss)
$tempDir = "C:\Users\Catchcatch31admin\deploy_temp"

Write-Output "=== 기존 파일 백업 ==="
Copy-Item -Path $htmlDir -Destination $backupDir -Recurse -Force

Write-Output "=== 새 파일 압축 해제 ==="
New-Item -ItemType Directory -Force -Path "$tempDir\extracted"
tar -xzf "$tempDir\frontdist.tar.gz" -C "$tempDir\extracted"

Write-Output "=== html 폴더 내용 교체 ==="
Get-ChildItem -Path $htmlDir | Remove-Item -Recurse -Force
Copy-Item -Path "$tempDir\extracted\*" -Destination $htmlDir -Recurse -Force

Write-Output "=== 불필요한 파일 제거 ==="
Remove-Item -Path "$htmlDir\.gitignore" -ErrorAction SilentlyContinue
Remove-Item -Path "$htmlDir\README.md" -ErrorAction SilentlyContinue
Remove-Item -Path "$htmlDir\_template.html" -ErrorAction SilentlyContinue

Write-Output "=== Nginx 리로드 ==="
Restart-Service nginx
Start-Sleep -Seconds 3

Write-Output "=== 헬스체크 ==="
$response = Invoke-WebRequest -Uri "http://localhost" -UseBasicParsing -TimeoutSec 10
if ($response.StatusCode -eq 200) {
    Write-Output "배포 성공: 200 OK"
} else {
    throw "헬스체크 실패"
}

Write-Output "=== 임시 파일 정리 ==="
Remove-Item -Path "$tempDir\frontdist.tar.gz" -Force
Remove-Item -Path "$tempDir\extracted" -Recurse -Force
