# 🔐 安全配置指南

本文档说明系统的安全配置和最佳实践。

## 已修复的安全问题

### ✅ 1. JWT密钥硬编码问题

**问题**: 之前JWT密钥硬编码在代码中，容易被攻击者利用伪造令牌。

**解决方案**:
- 生产环境**必须**通过环境变量设置 `JWT_SECRET`
- 如果未设置，生产环境将拒绝启动
- 开发环境会生成临时随机密钥并警告

**配置方法**:
```bash
# 生成强随机密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 添加到 .env 文件
JWT_SECRET=生成的随机密钥
```

### ✅ 2. CORS配置过于宽松

**问题**: 之前允许任何来源访问API (`origin: '*'`)，存在跨站攻击风险。

**解决方案**:
- 生产环境**必须**明确指定允许的域名
- 如果未设置，生产环境将拒绝启动
- 支持通过环境变量配置白名单

**配置方法**:
```bash
# .env 文件
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

### ✅ 3. 默认管理员密码泄露

**问题**: 超级管理员的默认密码 `admin123` 硬编码在代码中。

**解决方案**:
- 支持通过环境变量设置管理员凭据
- 如果未设置，会生成随机密码并在控制台显示
- 首次登录后强烈建议立即修改密码

**配置方法**:
```bash
# .env 文件
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=YourStrongPassword123!
ADMIN_NAME=系统管理员
```

### ✅ 4. 数据库路径安全改进

**问题**: 数据库路径可预测，可能遭受路径遍历攻击。

**解决方案**:
- 支持通过环境变量指定数据库路径
- 自动检查目录权限和创建必要目录
- 生产环境会警告不安全的文件权限
- 建议使用绝对路径

**配置方法**:
```bash
# .env 文件
DB_PATH=/var/lib/student-selection/database.sqlite

# 设置安全权限 (Linux/macOS)
chmod 600 /var/lib/student-selection/database.sqlite
```

## 快速开始

### 1. 复制环境变量模板

```bash
cp .env.example .env
```

### 2. 编辑 .env 文件

至少需要设置以下必需配置：

```bash
# JWT密钥（必需）
JWT_SECRET=your-generated-secret-key

# 管理员凭据（推荐）
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=YourStrongPassword123!

# CORS配置（生产环境必需）
ALLOWED_ORIGINS=https://yourdomain.com
```

### 3. 启动服务器

```bash
npm start
```

## 生产环境部署检查清单

部署到生产环境前，请确保完成以下检查：

- [ ] **环境变量配置**
  - [ ] `NODE_ENV=production`
  - [ ] `JWT_SECRET` 设置为强随机字符串（至少32位）
  - [ ] `ADMIN_PASSWORD` 设置为强密码（8位以上，包含大小写字母和数字）
  - [ ] `ALLOWED_ORIGINS` 设置为实际域名（不使用 `*`）

- [ ] **数据库安全**
  - [ ] 使用绝对路径配置 `DB_PATH`
  - [ ] 数据库文件权限设置为 `600` 或 `640`
  - [ ] 配置定期备份策略

- [ ] **网络安全**
  - [ ] 使用HTTPS（配置Nginx等反向代理）
  - [ ] 配置防火墙规则
  - [ ] 限制数据库文件的网络访问

- [ ] **代码安全**
  - [ ] `.env` 文件已添加到 `.gitignore`
  - [ ] 不要将敏感配置提交到版本控制
  - [ ] 定期更新依赖包

- [ ] **监控与日志**
  - [ ] 配置错误日志监控
  - [ ] 设置异常告警
  - [ ] 记录安全相关事件

## 密码策略

系统强制执行以下密码策略：

- 最小长度：8个字符
- 最大长度：32个字符
- 必须包含：
  - 至少一个小写字母 (a-z)
  - 至少一个大写字母 (A-Z)
  - 至少一个数字 (0-9)
- 禁止使用常见弱密码（如 123456、password 等）

## 安全最佳实践

### 1. 定期更新密钥

建议每3-6个月更换一次JWT密钥：

```bash
# 生成新密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 更新 .env 文件中的 JWT_SECRET
# 注意：更换密钥后所有用户需要重新登录
```

### 2. 备份策略

定期备份数据库文件：

```bash
# 自动备份脚本示例
#!/bin/bash
BACKUP_DIR=/var/backups/student-selection
DB_PATH=/var/lib/student-selection/database.sqlite
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
cp $DB_PATH $BACKUP_DIR/database_$DATE.sqlite

# 保留最近30天的备份
find $BACKUP_DIR -name "database_*.sqlite" -mtime +30 -delete
```

### 3. 监控异常登录

建议配置以下监控：

- 多次登录失败的IP地址
- 异常时间段的登录尝试
- 同一账号从不同地理位置登录

### 4. 使用HTTPS

生产环境必须使用HTTPS，推荐使用Nginx反向代理：

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 安全问题报告

如果发现安全漏洞，请通过以下方式报告：

1. **不要**在公开issue中讨论安全漏洞
2. 发送邮件至安全团队（如果有）
3. 提供详细的漏洞描述和复现步骤

## 更新日志

### 2026-02-07
- ✅ 修复JWT密钥硬编码问题
- ✅ 修复CORS配置过于宽松问题
- ✅ 修复默认管理员密码泄露问题
- ✅ 改进数据库路径安全配置
- ✅ 添加环境变量配置模板
- ✅ 完善安全文档

## 参考资源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
