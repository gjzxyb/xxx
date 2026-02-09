# 部署检查清单 - 学生分科自选系统

## 📋 部署前必读

本文档提供完整的生产环境部署检查清单，确保系统安全、稳定运行。

---

## ✅ 第一步：安装依赖

### 1.1 安装 Node.js 依赖

```bash
cd D:\xxx\server
npm install
```

**验证安装**：
```bash
npm list node-cron fs-extra archiver
```

应显示以下包已安装：
- `node-cron@^3.0.3`
- `fs-extra@^11.2.0`
- `archiver@^7.0.1`

---

## 🔐 第二步：环境变量配置

### 2.1 生成安全密钥

在 `server` 目录下运行以下命令生成密钥：

```bash
# 生成 JWT_SECRET (项目级认证密钥)
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# 生成 PLATFORM_JWT_SECRET (平台级认证密钥)
node -e "console.log('PLATFORM_JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# 生成 CSRF_SECRET (CSRF保护密钥)
node -e "console.log('CSRF_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

### 2.2 更新 .env 文件

编辑 `D:\xxx\server\.env`，填入生成的密钥：

```env
# 必需配置项
JWT_SECRET=[第一步生成的64位十六进制字符串]
PLATFORM_JWT_SECRET=[第二步生成的64位十六进制字符串]
CSRF_SECRET=[第三步生成的64位十六进制字符串]

# 管理员配置（首次启动创建超级管理员）
ADMIN_EMAIL=your-admin@example.com
ADMIN_PASSWORD=[强密码：至少8位，包含大小写字母、数字]
ADMIN_NAME=系统管理员

# 运行环境
NODE_ENV=production

# CORS配置（生产环境必须明确指定）
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# 自动备份配置
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 3 * * *
MAX_BACKUPS=7

# 速率限制（生产环境必须启用）
SKIP_RATE_LIMIT=false
MAX_LOGIN_ATTEMPTS=5
```

### 2.3 验证配置

运行配置验证：
```bash
node -e "require('dotenv').config(); console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✓ 已配置' : '✗ 未配置'); console.log('PLATFORM_JWT_SECRET:', process.env.PLATFORM_JWT_SECRET ? '✓ 已配置' : '✗ 未配置'); console.log('CSRF_SECRET:', process.env.CSRF_SECRET ? '✓ 已配置' : '✗ 未配置');"
```

---

## 🔒 第三步：安全加固检查

### 3.1 密码策略验证

- [ ] 管理员密码满足强度要求（8位以上，大小写字母+数字）
- [ ] 所有三个密钥（JWT_SECRET、PLATFORM_JWT_SECRET、CSRF_SECRET）都已设置且不同
- [ ] 密钥长度至少64位十六进制（32字节）

### 3.2 速率限制验证

- [ ] `SKIP_RATE_LIMIT=false` 已设置
- [ ] 登录限制：5次失败尝试/15分钟
- [ ] 选科提交限制：3次/分钟
- [ ] Excel导出限制：10次/小时

### 3.3 CSRF保护验证

- [ ] `CSRF_SECRET` 已配置
- [ ] 所有修改数据的API都受CSRF保护
- [ ] Token有效期：1小时

### 3.4 数据库安全

- [ ] SQLite数据库文件权限设置为 600（仅所有者可读写）
- [ ] 数据库路径遵循安全规范（无路径遍历风险）
- [ ] 项目ID使用UUID v4格式验证

### 3.5 敏感数据保护

- [ ] 日志输出已自动脱敏（密码、token、密钥等）
- [ ] Excel导出不包含密码字段
- [ ] 错误信息在生产环境下不暴露详细堆栈

---

## 💾 第四步：备份系统配置

### 4.1 验证备份管理器

检查备份工具是否正确集成：

```bash
# 查看 app.js 是否包含备份初始化代码
grep -A 5 "BACKUP_ENABLED" server/app.js
```

应看到类似输出：
```javascript
if (process.env.BACKUP_ENABLED === 'true') {
  const backupManager = require('./utils/backup');
  backupManager.startSchedule();
  console.log('✓ 自动备份已启动');
}
```

### 4.2 手动测试备份

首次部署前，手动创建一次备份测试：

```bash
node -e "const backup = require('./server/utils/backup'); backup.createBackup().then(result => console.log('备份成功:', result)).catch(err => console.error('备份失败:', err));"
```

成功后会在 `server/backups/` 目录生成 ZIP 文件。

### 4.3 备份恢复测试

测试备份恢复功能（在测试环境）：

```bash
node -e "const backup = require('./server/utils/backup'); backup.restoreBackup('[备份文件名].zip').then(() => console.log('恢复成功')).catch(err => console.error('恢复失败:', err));"
```

---

## 🚀 第五步：启动服务

### 5.1 首次启动

```bash
cd D:\xxx\server
npm start
```

### 5.2 验证启动信息

控制台应显示：

```
✓ 数据库已同步
✓ 默认超级管理员已创建
  邮箱: [你配置的ADMIN_EMAIL]
  密码: [你配置的ADMIN_PASSWORD]
✓ 默认科目模板已创建
✓ 默认平台配置已设置
========================================
  学生分科自选系统 (内嵌式 SaaS)
========================================
  系统访问: http://localhost:3000
  平台管理: http://localhost:3000/platform
  API地址:  http://localhost:3000/api
========================================
✓ 自动备份已启动
  计划: 0 3 * * * (每天凌晨3点)
  保留: 最近 7 个备份
========================================
```

---

## 🧪 第六步：功能测试

### 6.1 登录功能测试

**测试多用户同IP登录（修复验证）**：

1. 打开两个浏览器（或无痕模式）
2. 访问 `http://localhost:3000/?projectId=[项目ID]`
3. 使用不同学生账号登录
4. ✅ 两个账号都应成功登录（不再报423错误）

**测试速率限制**：

1. 连续6次输入错误密码
2. ✅ 第6次应被拒绝并提示"登录尝试过多"

### 6.2 管理员功能测试

**测试密码重置（修复验证）**：

1. 访问 `http://localhost:3000/admin.html?projectId=[项目ID]`
2. 使用管理员登录
3. 在学生列表中点击"重置密码"
4. ✅ 应弹出对话框显示新密码

**测试Excel导出脱敏**：

1. 导出学生列表
2. 打开Excel文件
3. ✅ 密码字段不应出现在导出数据中

### 6.3 平台管理测试

**测试CSS加载（修复验证）**：

1. 访问 `http://localhost:3000/platform/dashboard.html`
2. ✅ 页面样式应正常显示（无样式缺失）

### 6.4 选科功能测试

**测试并发安全**：

1. 使用多个账号同时选择同一科目
2. 科目容量限制应正确生效
3. ✅ 不应出现超额选科

### 6.5 备份功能测试

**验证定时备份**：

1. 等待第二天凌晨3点，或手动修改 `BACKUP_SCHEDULE`
2. 检查 `server/backups/` 目录
3. ✅ 应生成新的备份ZIP文件

**验证备份清理**：

1. 创建超过7个备份文件（修改 `MAX_BACKUPS=2` 测试）
2. 触发新备份
3. ✅ 最旧的备份应被自动删除

---

## 📊 第七步：监控与日志

### 7.1 日志检查

查看系统日志，确认无错误：

```bash
# Linux/Mac
tail -f server/logs/*.log

# Windows (PowerShell)
Get-Content server\logs\*.log -Wait
```

### 7.2 关键指标监控

- [ ] 登录成功率 > 95%
- [ ] API响应时间 < 500ms
- [ ] 数据库查询时间 < 100ms
- [ ] 备份成功率 = 100%

### 7.3 安全事件监控

关注以下日志事件：

- 连续登录失败（可能的暴力破解）
- CSRF验证失败（可能的跨站攻击）
- 路径遍历尝试（Invalid projectId format）
- 速率限制触发（Too many requests）

---

## 🔧 第八步：生产环境优化

### 8.1 反向代理配置（Nginx示例）

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 8.2 进程管理（PM2）

安装PM2：
```bash
npm install -g pm2
```

启动应用：
```bash
cd D:\xxx\server
pm2 start app.js --name student-selection
pm2 save
pm2 startup
```

监控：
```bash
pm2 monit
pm2 logs student-selection
```

### 8.3 数据库优化

- [ ] 定期运行 `VACUUM` 清理SQLite数据库
- [ ] 监控数据库文件大小
- [ ] 考虑在高并发场景迁移到PostgreSQL/MySQL

---

## 🛡️ 第九步：安全审计

### 9.1 依赖安全检查

```bash
cd D:\xxx\server
npm audit
npm audit fix
```

### 9.2 代码安全扫描

使用工具扫描：
- ESLint Security Plugin
- Snyk
- SonarQube

### 9.3 渗透测试

测试以下攻击场景：

- [ ] SQL注入
- [ ] XSS攻击
- [ ] CSRF攻击
- [ ] 路径遍历
- [ ] 暴力破解
- [ ] 会话劫持

---

## 📝 第十步：文档归档

### 10.1 保存关键信息

创建安全的文档记录：

- ✅ 所有密钥的备份（加密存储）
- ✅ 管理员账号信息
- ✅ 备份恢复流程
- ✅ 应急联系人

### 10.2 运维手册

文档应包含：

- 日常备份检查流程
- 故障排查指南
- 数据恢复步骤
- 安全事件响应流程

---

## ✅ 最终检查清单

部署前最后确认：

### 环境配置
- [ ] `NODE_ENV=production`
- [ ] 所有密钥已生成且不同
- [ ] 管理员密码符合强度要求
- [ ] CORS已限制为实际域名

### 安全功能
- [ ] 速率限制已启用
- [ ] CSRF保护已启用
- [ ] 密码策略已生效
- [ ] 路径遍历防护已验证
- [ ] 日志脱敏已验证

### 备份系统
- [ ] 自动备份已启用
- [ ] 备份计划已配置
- [ ] 手动备份测试成功
- [ ] 恢复测试成功

### 功能测试
- [ ] 多用户同IP登录正常
- [ ] 密码重置显示新密码
- [ ] 平台CSS正常加载
- [ ] 选科并发安全验证
- [ ] Excel导出脱敏验证

### 监控与日志
- [ ] 日志路径已配置
- [ ] 监控指标已定义
- [ ] 告警规则已设置

### 文档与培训
- [ ] 运维文档已准备
- [ ] 管理员已培训
- [ ] 应急流程已制定

---

## 🆘 故障排查

### 常见问题

**1. 服务启动失败**
```bash
# 检查端口占用
netstat -ano | findstr :3000

# 检查环境变量
node -e "require('dotenv').config(); console.log(process.env)"
```

**2. 依赖安装失败**
```bash
# 清除缓存重新安装
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**3. 备份失败**
```bash
# 检查目录权限
ls -la server/backups
mkdir -p server/backups
chmod 755 server/backups
```

**4. 数据库错误**
```bash
# 检查数据库文件权限
ls -la server/databases/*.db
chmod 600 server/databases/*.db
```

---

## 📞 支持与联系

如遇问题，请按以下顺序排查：

1. 查看本文档故障排查章节
2. 检查 `SECURITY_FIXES_SUMMARY.md` 文档
3. 查看服务器日志
4. 联系系统管理员

---

**文档版本**: 1.0.0  
**最后更新**: 2026-02-09  
**维护人员**: 系统管理员
