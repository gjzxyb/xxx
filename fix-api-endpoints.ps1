$dashboardFile = "D:\xxx\client\platform\dashboard.html"
$superadminFile = "D:\xxx\client\platform\superadmin.html"
$loginFile = "D:\xxx\client\platform\login.html"
$registerFile = "D:\xxx\client\platform\register.html"

# 使用UTF8 without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

# 修复login.html
$content = [System.IO.File]::ReadAllText($loginFile, [System.Text.Encoding]::UTF8)
$content = $content -replace "fetch\('/api/auth/login'", "fetch('/api/platform/auth/login'"
[System.IO.File]::WriteAllText($loginFile, $content, $utf8NoBom)

# 修复register.html
$content = [System.IO.File]::ReadAllText($registerFile, [System.Text.Encoding]::UTF8)
$content = $content -replace "fetch\('/api/auth/registration-status'\)", "fetch('/api/platform/auth/registration-status')"
$content = $content -replace "fetch\('/api/auth/captcha'\)", "fetch('/api/platform/auth/captcha')"
$content = $content -replace "fetch\('/api/auth/register'", "fetch('/api/platform/auth/register'"
[System.IO.File]::WriteAllText($registerFile, $content, $utf8NoBom)

# 修复dashboard.html
$content = [System.IO.File]::ReadAllText($dashboardFile, [System.Text.Encoding]::UTF8)
$content = $content -replace "fetch\('/api/projects", "fetch('/api/platform/projects"
$content = $content -replace 'fetch\(`/api/projects', 'fetch(`/api/platform/projects'
[System.IO.File]::WriteAllText($dashboardFile, $content, $utf8NoBom)

# 修复superadmin.html
$content = [System.IO.File]::ReadAllText($superadminFile, [System.Text.Encoding]::UTF8)
$content = $content -replace "fetch\('/api/superadmin", "fetch('/api/platform/superadmin"
$content = $content -replace "fetch\('/api/projects", "fetch('/api/platform/projects"
$content = $content -replace 'fetch\(`/api/superadmin', 'fetch(`/api/platform/superadmin'
$content = $content -replace 'fetch\(`/api/projects', 'fetch(`/api/platform/projects'
[System.IO.File]::WriteAllText($superadminFile, $content, $utf8NoBom)

Write-Host "All API endpoints fixed with proper UTF-8 encoding!"
