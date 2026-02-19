# 故障排查指南 🔧

本文档提供常见问题的诊断和解决方案。

## 📋 目录

- [启动问题](#启动问题)
- [数据库问题](#数据库问题)
- [认证问题](#认证问题)
- [API 问题](#api-问题)
- [前端问题](#前端问题)
- [性能问题](#性能问题)
- [部署问题](#部署问题)

---

## 启动问题

### 问题：端口 3000 被占用

**错误信息**：
```
Error: listen EADDRINUSE: address already in use :::3000
```

**解决方案**：

**Windows**：
```bash
# 查找占用端口的进程
netstat -ano | findstr :3000

# 结束进程（替换 <PID> 为实际进程ID）
taskkill /PID <PID> /F
```

**Linux/Mac**：
```bash
# 查找占用端口的进程
lsof -i :3000

# 结束进程
kill -9 <PID>
```

**或者修改端口**：
```bash
# 在 .env 文件中设置
PORT=3001
```

---

### 问题：缺少环境变量

**错误信息**：
```
Error: JWT_SECRET is required in production
```

**解决方案**：

1. 检查 `.env` 文件是否存在：
```bash
ls -la .env
```

2. 如果不存在，复制模板：
```bash
cp .env.example .env
```

3. 生成必需的密钥：
```bash
# 生成 JWT_SECRET
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# 生成 PLATFORM_JWT_SECRET
node -e "console.log('PLATFORM_JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# 生成 CSRF_SECRET
node -e "console.log('CSRF_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

4. 将生成的密钥添加到 `.env` 文件

---

### 问题：依赖安装失败

**错误信息**：
```
npm ERR! code ENOENT
npm ERR! syscall open
```

**解决方案**：

```bash
# 清除 npm 缓存
npm cache clean --force

# 删除 node_modules 和 lock 文件
rm -rf node_modules package-lock.json

# 重新安装
npm install

# 如果还是失败，尝试使用 --legacy-peer-deps
npm install --legacy-peer-deps
```

---

### 问题：SQLite3 编译失败

**错误信息**：
```
Error: Cannot find module 'node_sqlite3.node'
```

**解决方案**：

```bash
# 重新编译 sqlite3
npm rebuild sqlite3

# 或者使用预编译版本
npm install sqlite3 --build-from-source=false
```

**Windows 特殊情况**：
```bash
# 安装 windows-build-tools
npm install --global windows-build-tools

# 然后重新安装 sqlite3
npm install sqlite3
```

---

## 数据库问题

### 问题：数据库锁定

**错误信息**：
```
Error: SQLITE_BUSY: database is locked
```

**原因**：
- 另一个进程正在访问数据库
- 数据库文件被其他程序打开（如 DB Browser）

**解决方案**：

1. 关闭所有访问数据库的程序
2. 删除临时文件：
```bash
cd server/databases
rm *.db-shm *.db-wal
```

3. 如果问题持续，重启服务器

---

### 问题：数据库文件不存在

**错误信息**：
```
Error: SQLITE_CANTOPEN: unable to open database file
```

**解决方案**：

1. 检查数据库目录是否存在：
```bash
ls -la server/databases/
```

2. 如果不存在，创建目录：
```bash
mkdir -p server/databases
```

3. 重启服务器，会自动创建数据库文件

---

### 问题：数据库迁移失败

**错误信息**：
```
Error: Validation error: column does not exist
```

**解决方案**：

```bash
# 备份现有数据库
cp server/databases/*.db backup/

# 删除数据库文件（谨慎！）
rm server/databases/*.db

# 重启服务器重新创建
npm start
```

**如果需要保留数据**：
```bash
# 导出数据
sqlite3 server/databases/platform.db .dump > backup.sql

# 删除数据库
rm server/databases/platform.db

# 重启服务器
npm start

# 导入数据（需要手动调整 SQL）
sqlite3 server/databases/platform.db < backup.sql
```

---

## 认证问题

### 问题：JWT 验证失败

**错误信息**：
```
401 Unauthorized: Invalid token
```

**可能原因**：
1. Token 已过期
2. JWT_SECRET 不匹配
3. Token 格式错误

**解决方案**：

1. 检查 Token 是否过期：
```javascript
// 在浏览器控制台解码 Token
const token = 'your-token-here';
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('过期时间:', new Date(payload.exp * 1000));
```

2. 验证 JWT_SECRET：
```bash
# 检查 .env 文件
cat .env | grep JWT_SECRET
```

3. 清除浏览器存储重新登录：
```javascript
// 在浏览器控制台执行
localStorage.clear();
sessionStorage.clear();
```

---

### 问题：CSRF 验证失败

**错误信息**：
```
403 Forbidden: CSRF token validation failed
```

**解决方案**：

1. 检查请求头是否包含 CSRF Token：
```javascript
// 在浏览器控制台查看
console.log(localStorage.getItem('csrfToken'));
```

2. 确保前端正确设置请求头：
```javascript
headers: {
  'X-CSRF-Token': localStorage.getItem('csrfToken')
}
```

3. 开发环境可以临时禁用 CSRF：
```env
# .env
SKIP_CSRF=true
```

---

### 问题：速率限制触发

**错误信息**：
```
429 Too Many Requests
```

**解决方案**：

1. 等待限制时间过期（通常 15 分钟）

2. 开发环境可以禁用速率限制：
```env
# .env
SKIP_RATE_LIMIT=true
```

3. 生产环境调整限制配置：
```javascript
// server/middleware/rateLimit.js
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15分钟
  max: 10,  // 增加到10次
});
```

---

## API 问题

### 问题：CORS 错误

**错误信息**：
```
Access to fetch at 'http://localhost:3000/api/...' from origin 'http://localhost:5173'
has been blocked by CORS policy
```

**解决方案**：

1. 检查 ALLOWED_ORIGINS 配置：
```env
# .env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

2. 确保包含所有需要的源

3. 开发环境可以允许所有源：
```env
# .env (仅开发环境)
NODE_ENV=development
ALLOWED_ORIGINS=*
```

---

### 问题：请求超时

**错误信息**：
```
Error: timeout of 30000ms exceeded
```

**可能原因**：
1. 数据库查询慢
2. 网络问题
3. 服务器负载高

**解决方案**：

1. 检查数据库查询性能：
```javascript
// 添加查询日志
const { QueryTypes } = require('sequelize');
sequelize.query('EXPLAIN QUERY PLAN SELECT * FROM Users', {
  type: QueryTypes.SELECT
});
```

2. 优化查询：
```javascript
// 添加索引
User.addIndex(['studentId']);

// 限制返回字段
User.findAll({
  attributes: ['id', 'name', 'studentId']
});
```

3. 增加超时时间：
```javascript
// 前端
axios.get('/api/users', { timeout: 60000 });
```

---

### 问题：数据返回不完整

**错误信息**：
```
Response data is truncated
```

**解决方案**：

1. 检查是否有分页：
```javascript
// 使用分页参数
GET /api/admin/students?page=1&limit=20
```

2. 检查数据库查询限制：
```javascript
// 移除 limit
User.findAll({
  // limit: 100  // 移除这行
});
```

---

## 前端问题

### 问题：页面样式丢失

**症状**：页面显示但没有样式

**解决方案**：

1. 检查 CSS 文件路径：
```html
<!-- 确保路径正确 -->
<link rel="stylesheet" href="/css/style.css">
<!-- 或 -->
<link rel="stylesheet" href="css/style.css">
```

2. 检查浏览器控制台的 404 错误

3. 清除浏览器缓存：
```
Ctrl + Shift + Delete (Windows)
Cmd + Shift + Delete (Mac)
```

4. 强制刷新：
```
Ctrl + F5 (Windows)
Cmd + Shift + R (Mac)
```

---

### 问题：JavaScript 错误

**错误信息**：
```
Uncaught ReferenceError: xxx is not defined
```

**解决方案**：

1. 检查 script 标签顺序：
```html
<!-- 依赖的脚本要先加载 -->
<script src="/js/api.js"></script>
<script src="/js/main.js"></script>
```

2. 检查变量作用域：
```javascript
// 确保变量在使用前已定义
let token = localStorage.getItem('token');
if (token) {
  // 使用 token
}
```

3. 使用浏览器开发者工具调试：
```
F12 → Console 标签页
```

---

### 问题：LocalStorage 数据丢失

**症状**：刷新页面后需要重新登录

**可能原因**：
1. 使用了 sessionStorage 而不是 localStorage
2. 浏览器隐私模式
3. 浏览器清除了数据

**解决方案**：

1. 确认使用 localStorage：
```javascript
// ✅ 正确
localStorage.setItem('token', token);

// ❌ 错误（会话结束后清除）
sessionStorage.setItem('token', token);
```

2. 检查浏览器设置：
- 不要使用隐私/无痕模式
- 允许网站存储数据

---

## 性能问题

### 问题：页面加载慢

**诊断步骤**：

1. 使用浏览器性能工具：
```
F12 → Network 标签页
查看各资源加载时间
```

2. 检查数据库查询：
```javascript
// 添加查询日志
sequelize.options.logging = console.log;
```

3. 检查 API 响应时间：
```bash
# 使用 curl 测试
time curl http://localhost:3000/api/subjects
```

**优化方案**：

1. 添加数据库索引：
```javascript
User.addIndex(['studentId']);
Subject.addIndex(['code']);
```

2. 使用分页：
```javascript
const { count, rows } = await User.findAndCountAll({
  limit: 20,
  offset: (page - 1) * 20
});
```

3. 压缩响应：
```javascript
const compression = require('compression');
app.use(compression());
```

---

### 问题：内存泄漏

**症状**：
- 服务器内存持续增长
- 最终崩溃

**诊断**：

```javascript
// 监控内存使用
setInterval(() => {
  const used = process.memoryUsage();
  console.log('内存使用:', {
    rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`
  });
}, 60000);
```

**解决方案**：

1. 检查数据库连接是否正确关闭
2. 避免全局变量累积数据
3. 使用 PM2 自动重启：
```bash
pm2 start app.js --max-memory-restart 500M
```

---

## 部署问题

### 问题：生产环境启动失败

**检查清单**：

1. 环境变量配置：
```bash
# 检查所有必需的环境变量
node -e "
require('dotenv').config();
const required = ['JWT_SECRET', 'PLATFORM_JWT_SECRET', 'CSRF_SECRET'];
required.forEach(key => {
  console.log(key + ':', process.env[key] ? '✓' : '✗');
});
"
```

2. 文件权限：
```bash
# 数据库文件权限
chmod 600 server/databases/*.db

# 日志目录权限
chmod 755 server/logs
```

3. 端口访问：
```bash
# 检查防火墙
sudo ufw status

# 允许端口
sudo ufw allow 3000
```

---

### 问题：Nginx 反向代理错误

**错误信息**：
```
502 Bad Gateway
```

**解决方案**：

1. 检查 Node.js 服务是否运行：
```bash
pm2 status
```

2. 检查 Nginx 配置：
```bash
sudo nginx -t
```

3. 查看 Nginx 错误日志：
```bash
sudo tail -f /var/log/nginx/error.log
```

4. 确保 proxy_pass 地址正确：
```nginx
location / {
    proxy_pass http://localhost:3000;  # 确认端口正确
}
```

---

## 日志分析

### 查看日志

```bash
# 实时查看日志
tail -f server/logs/*.log

# 搜索错误
grep "Error" server/logs/*.log

# 查看最近的错误
tail -100 server/logs/error.log
```

### 常见错误模式

**数据库错误**：
```
SQLITE_BUSY: database is locked
SQLITE_CANTOPEN: unable to open database
```

**认证错误**：
```
JsonWebTokenError: invalid token
TokenExpiredError: jwt expired
```

**权限错误**：
```
EACCES: permission denied
EPERM: operation not permitted
```

---

## 获取帮助

如果以上方案都无法解决问题：

1. **收集信息**：
   - 错误信息完整截图
   - 相关日志
   - 环境信息（OS、Node.js版本等）
   - 复现步骤

2. **搜索已有 Issues**：
   - 在 GitHub Issues 中搜索类似问题

3. **创建新 Issue**：
   - 使用 Bug 报告模板
   - 提供详细信息

4. **联系维护者**：
   - 紧急问题可以直接联系

---

## 预防措施

### 开发环境

1. 定期更新依赖：
```bash
npm outdated
npm update
```

2. 使用版本控制：
```bash
git commit -m "feat: 添加新功能"
```

3. 定期备份数据库：
```bash
cp server/databases/*.db backup/
```

### 生产环境

1. 监控服务状态：
```bash
pm2 monit
```

2. 设置告警：
```bash
pm2 install pm2-logrotate
```

3. 定期检查日志：
```bash
# 每天检查错误日志
crontab -e
0 9 * * * grep "Error" /path/to/logs/*.log | mail -s "Daily Error Report" admin@example.com
```

---

**最后更新**: 2026-02-19
**维护者**: 运维团队
