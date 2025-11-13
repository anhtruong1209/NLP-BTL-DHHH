# Script PowerShell để deploy lên IIS
# Chạy với quyền Administrator: .\deploy-iis.ps1

param(
    [string]$SiteName = "ChatBot-NLP-VMU",
    [string]$AppPoolName = "ChatBotNLPAppPool",
    [string]$Port = "80",
    [string]$DestinationPath = "C:\inetpub\wwwroot\chatbot-nlp-vmu"
)

$ErrorActionPreference = "Stop"

# Lấy đường dẫn hiện tại
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourcePath = Join-Path $ScriptPath "dist"

Write-Host "🚀 Bắt đầu deploy lên IIS..." -ForegroundColor Green
Write-Host "Source: $SourcePath" -ForegroundColor Cyan
Write-Host "Destination: $DestinationPath" -ForegroundColor Cyan

# Kiểm tra thư mục source
if (-not (Test-Path $SourcePath)) {
    Write-Host "❌ Thư mục dist không tồn tại! Vui lòng chạy 'pnpm build:iis' trước." -ForegroundColor Red
    exit 1
}

# Kiểm tra web.config
$webConfigPath = Join-Path $SourcePath "web.config"
if (-not (Test-Path $webConfigPath)) {
    Write-Host "⚠️  web.config không tìm thấy trong dist, đang copy..." -ForegroundColor Yellow
    $sourceWebConfig = Join-Path $ScriptPath "web.config"
    if (Test-Path $sourceWebConfig) {
        Copy-Item $sourceWebConfig $webConfigPath -Force
        Write-Host "✓ Đã copy web.config" -ForegroundColor Green
    } else {
        Write-Host "❌ Không tìm thấy web.config!" -ForegroundColor Red
        exit 1
    }
}

# Kiểm tra quyền Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "⚠️  Cần quyền Administrator để tạo website. Đang thử copy files..." -ForegroundColor Yellow
} else {
    Write-Host "✓ Đang chạy với quyền Administrator" -ForegroundColor Green
}

# Import WebAdministration module
try {
    Import-Module WebAdministration -ErrorAction Stop
    Write-Host "✓ WebAdministration module đã được import" -ForegroundColor Green
} catch {
    Write-Host "❌ Không thể import WebAdministration module. Đảm bảo IIS đã được cài đặt." -ForegroundColor Red
    exit 1
}

# Tạo thư mục đích nếu chưa có
if (-not (Test-Path $DestinationPath)) {
    Write-Host "📁 Đang tạo thư mục đích..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $DestinationPath -Force | Out-Null
}

# Copy files
Write-Host "📦 Đang copy files..." -ForegroundColor Cyan
Copy-Item -Path "$SourcePath\*" -Destination $DestinationPath -Recurse -Force
Write-Host "✓ Files đã được copy" -ForegroundColor Green

if ($isAdmin) {
    # Tạo Application Pool nếu chưa có
    if (-not (Test-Path "IIS:\AppPools\$AppPoolName")) {
        Write-Host "🏊 Đang tạo Application Pool..." -ForegroundColor Cyan
        New-WebAppPool -Name $AppPoolName
        Set-ItemProperty -Path "IIS:\AppPools\$AppPoolName" -Name "managedRuntimeVersion" -Value ""
        Write-Host "✓ Application Pool đã được tạo" -ForegroundColor Green
    } else {
        Write-Host "✓ Application Pool đã tồn tại" -ForegroundColor Green
    }

    # Tạo hoặc cập nhật Website
    if (Get-Website -Name $SiteName -ErrorAction SilentlyContinue) {
        Write-Host "🔄 Website đã tồn tại, đang cập nhật..." -ForegroundColor Cyan
        Set-ItemProperty -Path "IIS:\Sites\$SiteName" -Name "physicalPath" -Value $DestinationPath
        Set-ItemProperty -Path "IIS:\Sites\$SiteName" -Name "applicationPool" -Value $AppPoolName
        Write-Host "✓ Website đã được cập nhật" -ForegroundColor Green
    } else {
        Write-Host "🌐 Đang tạo Website mới..." -ForegroundColor Cyan
        New-WebSite -Name $SiteName -Port $Port -PhysicalPath $DestinationPath -ApplicationPool $AppPoolName
        Write-Host "✓ Website đã được tạo" -ForegroundColor Green
    }

    # Khởi động website
    Write-Host "▶️  Đang khởi động website..." -ForegroundColor Cyan
    Start-Website -Name $SiteName
    Write-Host "✓ Website đã được khởi động" -ForegroundColor Green
}

# Cấu hình quyền truy cập
Write-Host "🔐 Đang cấu hình quyền truy cập..." -ForegroundColor Cyan
$acl = Get-Acl $DestinationPath
$permission = "IIS_IUSRS", "ReadAndExecute", "ContainerInherit,ObjectInherit", "None", "Allow"
$accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
$acl.SetAccessRule($accessRule)
Set-Acl $DestinationPath $acl
Write-Host "✓ Quyền truy cập đã được cấu hình" -ForegroundColor Green

Write-Host ""
Write-Host "✅ Deploy hoàn tất!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Thông tin:" -ForegroundColor Cyan
Write-Host "   Website: $SiteName" -ForegroundColor White
Write-Host "   URL: http://localhost:$Port" -ForegroundColor White
Write-Host "   Path: $DestinationPath" -ForegroundColor White
Write-Host ""
Write-Host "💡 Lưu ý:" -ForegroundColor Yellow
Write-Host "   - Đảm bảo URL Rewrite Module đã được cài đặt" -ForegroundColor White
Write-Host "   - Kiểm tra firewall cho phép port $Port" -ForegroundColor White
Write-Host "   - Nếu dùng domain, cấu hình DNS trỏ về server" -ForegroundColor White

