# 平台功能自动化测试脚本
# 测试登录、项目管理、启动/停止功能

$baseUrl = "http://localhost:3000"
$testResults = @()

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  平台功能自动化测试" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 测试1: 健康检查
Write-Host "[测试1] 健康检查..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/health" -Method Get
    if ($response.code -eq 200) {
        Write-Host "✓ 健康检查成功" -ForegroundColor Green
        $testResults += "健康检查: PASS"
    } else {
        Write-Host "✗ 健康检查失败" -ForegroundColor Red
        $testResults += "健康检查: FAIL"
    }
} catch {
    Write-Host "✗ 健康检查失败: $_" -ForegroundColor Red
    $testResults += "健康检查: FAIL"
}

Write-Host ""

# 测试2: 登录
Write-Host "[测试2] 登录测试..." -ForegroundColor Yellow
$loginBody = @{
    email = "admin@platform.com"
    password = "admin123"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/platform/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    if ($response.code -eq 200) {
        $token = $response.data.token
        $user = $response.data.user
        Write-Host "✓ 登录成功" -ForegroundColor Green
        Write-Host "  用户: $($user.name)" -ForegroundColor Gray
        Write-Host "  邮箱: $($user.email)" -ForegroundColor Gray
        Write-Host "  超级管理员: $($user.isSuperAdmin)" -ForegroundColor Gray
        Write-Host "  项目配额: $($user.maxProjects)" -ForegroundColor Gray
        $testResults += "登录: PASS"
    } else {
        Write-Host "✗ 登录失败: $($response.message)" -ForegroundColor Red
        $testResults += "登录: FAIL"
        exit
    }
} catch {
    Write-Host "✗ 登录失败: $_" -ForegroundColor Red
    $testResults += "登录: FAIL"
    exit
}

Write-Host ""

# 测试3: 获取项目列表
Write-Host "[测试3] 获取项目列表..." -ForegroundColor Yellow
$headers = @{
    "Authorization" = "Bearer $token"
}

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/platform/projects" -Method Get -Headers $headers
    if ($response.code -eq 200) {
        $ownedCount = $response.data.owned.Count
        $collaboratedCount = $response.data.collaborated.Count
        Write-Host "✓ 获取项目列表成功" -ForegroundColor Green
        Write-Host "  拥有的项目: $ownedCount 个" -ForegroundColor Gray
        Write-Host "  协作的项目: $collaboratedCount 个" -ForegroundColor Gray
        $projects = $response.data.owned
        $testResults += "获取项目列表: PASS"
    } else {
        Write-Host "✗ 获取项目列表失败" -ForegroundColor Red
        $testResults += "获取项目列表: FAIL"
    }
} catch {
    Write-Host "✗ 获取项目列表失败: $_" -ForegroundColor Red
    $testResults += "获取项目列表: FAIL"
}

Write-Host ""

# 测试4: 创建项目（如果还没有项目）
if ($projects.Count -eq 0) {
    Write-Host "[测试4] 创建测试项目..." -ForegroundColor Yellow
    $createBody = @{
        name = "测试项目"
        description = "自动化测试创建的项目"
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/platform/projects" -Method Post -Body $createBody -ContentType "application/json" -Headers $headers
        if ($response.code -eq 200) {
            $projectId = $response.data.id
            Write-Host "✓ 创建项目成功" -ForegroundColor Green
            Write-Host "  项目ID: $projectId" -ForegroundColor Gray
            Write-Host "  项目名称: $($response.data.name)" -ForegroundColor Gray
            $testResults += "创建项目: PASS"

            # 重新获取项目列表
            $response = Invoke-RestMethod -Uri "$baseUrl/api/platform/projects" -Method Get -Headers $headers
            $projects = $response.data.owned
        } else {
            Write-Host "✗ 创建项目失败" -ForegroundColor Red
            $testResults += "创建项目: FAIL"
        }
    } catch {
        Write-Host "✗ 创建项目失败: $_" -ForegroundColor Red
        $testResults += "创建项目: FAIL"
    }
    Write-Host ""
}

# 测试5: 启动项目
if ($projects.Count -gt 0) {
    $projectId = $projects[0].id
    $projectName = $projects[0].name

    Write-Host "[测试5] 启动项目..." -ForegroundColor Yellow
    Write-Host "  项目ID: $projectId" -ForegroundColor Gray
    Write-Host "  项目名称: $projectName" -ForegroundColor Gray

    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/platform/projects/$projectId/start" -Method Post -Headers $headers
        if ($response.code -eq 200) {
            Write-Host "✓ 启动项目成功" -ForegroundColor Green
            Write-Host "  分配端口: $($response.data.port)" -ForegroundColor Gray
            Write-Host "  访问地址: $($response.data.url)" -ForegroundColor Gray
            $testResults += "启动项目: PASS"

            # 验证状态
            Start-Sleep -Seconds 1
            $verifyResponse = Invoke-RestMethod -Uri "$baseUrl/api/platform/projects" -Method Get -Headers $headers
            $project = $verifyResponse.data.owned | Where-Object { $_.id -eq $projectId }

            if ($project.status -eq "running" -and $project.port) {
                Write-Host "✓ 状态验证成功" -ForegroundColor Green
                Write-Host "  当前状态: $($project.status)" -ForegroundColor Gray
                Write-Host "  运行端口: $($project.port)" -ForegroundColor Gray
                $testResults += "状态验证: PASS"
            } else {
                Write-Host "✗ 状态验证失败" -ForegroundColor Red
                $testResults += "状态验证: FAIL"
            }
        } else {
            Write-Host "✗ 启动项目失败: $($response.message)" -ForegroundColor Red
            $testResults += "启动项目: FAIL"
        }
    } catch {
        Write-Host "✗ 启动项目失败: $_" -ForegroundColor Red
        $testResults += "启动项目: FAIL"
    }

    Write-Host ""

    # 测试6: 停止项目
    Write-Host "[测试6] 停止项目..." -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/platform/projects/$projectId/stop" -Method Post -Headers $headers
        if ($response.code -eq 200) {
            Write-Host "✓ 停止项目成功" -ForegroundColor Green
            $testResults += "停止项目: PASS"

            # 验证状态
            Start-Sleep -Seconds 1
            $verifyResponse = Invoke-RestMethod -Uri "$baseUrl/api/platform/projects" -Method Get -Headers $headers
            $project = $verifyResponse.data.owned | Where-Object { $_.id -eq $projectId }

            if ($project.status -eq "stopped") {
                Write-Host "✓ 停止验证成功" -ForegroundColor Green
                Write-Host "  当前状态: $($project.status)" -ForegroundColor Gray
                $testResults += "停止验证: PASS"
            } else {
                Write-Host "✗ 停止验证失败" -ForegroundColor Red
                $testResults += "停止验证: FAIL"
            }
        } else {
            Write-Host "✗ 停止项目失败" -ForegroundColor Red
            $testResults += "停止项目: FAIL"
        }
    } catch {
        Write-Host "✗ 停止项目失败: $_" -ForegroundColor Red
        $testResults += "停止项目: FAIL"
    }
}

# 测试总结
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  测试结果汇总" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
foreach ($result in $testResults) {
    if ($result -like "*PASS*") {
        Write-Host "✓ $result" -ForegroundColor Green
    } else {
        Write-Host "✗ $result" -ForegroundColor Red
    }
}

$passCount = ($testResults | Where-Object { $_ -like "*PASS*" }).Count
$totalCount = $testResults.Count
$passRate = [math]::Round(($passCount / $totalCount) * 100, 2)

Write-Host ""
Write-Host "通过率: $passRate% ($passCount/$totalCount)" -ForegroundColor $(if ($passRate -eq 100) { "Green" } else { "Yellow" })
Write-Host "========================================" -ForegroundColor Cyan
