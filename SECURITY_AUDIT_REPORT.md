# 全面代码安全审计报告

**项目名称**: 学生分科自选系统
**审计日期**: 2026-02-09
**审计对象**: Node.js 后端代码 (Server & Platform)
**审计结果摘要**:
本次审计发现了多个安全风险，包括认证机制缺陷、潜在的并发问题、配置不当以及信息泄露风险。虽然项目使用了 Sequelize ORM 减少了 SQL 注入风险，并实现了基本的 JWT 认证和 CSRF 保护，但在深度防御和生产环境配置方面仍有不足。

---

## 1. 严重级别：严重 (Critical)

### 1.1 JWT 密钥配置与管理不当

**文件路径**: 
- `server/middleware/auth.js` (L7-18)
- `platform/server/middleware/auth.js` (L4-10)
- `server/middleware/projectAuth.js` (L8-13)

**问题描述**:
1.  代码中存在硬编码的 fallback 逻辑或对环境变量依赖的非强制性检查（在非 auth.js 文件中）。
2.  虽然 `projectAuth.js` 和 `platform/server/middleware/auth.js` 强制要求 `JWT_SECRET`，但在 `server/middleware/auth.js` 中，开发环境下会生成临时密钥。如果在生产环境配置不当回退到开发模式，或者环境变量未正确加载，可能导致使用弱密钥或每次重启失效。
3.  最关键的是，**所有模块似乎共享同一个 `JWT_SECRET` 环境变量**。如果平台（Platform）和项目（Project）使用相同的密钥签发 Token，且 Token 结构相似（都包含 `userId`），可能导致**跨系统越权访问**。例如，一个在 Project A 的 Token 可能被误认为 Platform 的有效 Token，或者反之，取决于 Token 验证逻辑是否校验了 Issuer 或 Audience，目前代码中未见此校验。

**修复建议**:
1.  **分离密钥**：平台和项目服务必须使用不同的密钥环境变量，例如 `PLATFORM_JWT_SECRET` 和 `PROJECT_JWT_SECRET`。
2.  **强制配置**：在生产环境启动时，如果未设置特定环境变量，应直接崩溃退出，而不是使用默认值或临时值。
3.  **增强 Token 验证**：在 JWT Payload 中添加 `type` (platform/project) 和 `projectId` (对于项目用户) 字段，并在验证中间件中严格检查这些字段，防止 Token 混用。

**代码示例**:
```javascript
// server/middleware/auth.js
const PROJECT_JWT_SECRET = process.env.PROJECT_JWT_SECRET;
if (!PROJECT_JWT_SECRET) throw new Error("Missing PROJECT_JWT_SECRET");

// 验证时检查 payload 结构
const authenticate = (req, res, next) => {
  // ...
  const decoded = jwt.verify(token, PROJECT_JWT_SECRET);
  if (decoded.type !== 'project_user') return unauthorized(res);
  // ...
};
```

### 1.2 选科提交中的并发竞态条件风险

**文件路径**: `server/routes/selections.js` (L160-242)

**问题描述**:
虽然代码使用了 `SERIALIZABLE` 隔离级别的事务 (L162) 和行锁 (`LOCK.UPDATE`)，但在 SQLite 中，`SERIALIZABLE` 可能会导致大量的 `SQLITE_BUSY` 错误，因为 SQLite 默认是库级锁（WAL模式下是文件级）。在高并发选科场景下（如几百学生同时提交），这可能导致严重的性能问题甚至死锁/超时，导致选科失败。
更重要的是，`checkCapacity` 函数中统计已选人数时使用了 `count` 查询 (L169)，即使在事务中，如果隔离级别或锁机制在某些 SQLite 配置下不生效（例如未开启 WAL 或使用了不支持锁的驱动配置），仍可能出现超卖。

**修复建议**:
1.  **数据库层面约束**：不仅仅依赖应用层代码检查。在数据库表中添加触发器或约束，或者使用原子更新操作（如 `capacity = capacity - 1`，虽然这里是统计记录数，不太适用）。
2.  **队列机制**：对于秒杀/抢课类高并发场景，建议引入内存队列（如 Redis List 或简单的内存数组）串行化处理提交请求，再异步写入数据库。
3.  **优化锁策略**：如果必须使用数据库锁，确保 SQLite 开启了 WAL 模式，并考虑使用 `EXCLUSIVE` 事务模式。

---

## 2. 严重级别：高 (High)

### 2.1 缺乏速率限制 (Rate Limiting)

**文件路径**: 全局路由

**问题描述**:
虽然文件列表中看到了 `server/middleware/rateLimiter.js`，但在读取的核心路由文件（如 `auth.js`, `selections.js`）中并未显式看到针对关键接口（如登录、提交选科）应用了特定的强速率限制。
- `POST /api/auth/login`: 暴力破解密码风险。
- `POST /api/selections`: 刷课脚本风险。

**修复建议**:
在关键接口显式挂载速率限制中间件。

**代码示例**:
```javascript
const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 限制5次
  message: '登录失败次数过多，请稍后再试'
});
router.post('/login', loginLimiter, ...);
```

### 2.2 敏感数据暴露风险

**文件路径**: 
- `server/routes/admin.js` (L153 `import-students`)
- `server/routes/selections.js` (L329 `export`)

**问题描述**:
1.  **Excel 导出**: 导出功能 (L358) 包含学生姓名、学号等信息。如果未授权的用户（如越权访问）能调用此接口，将导致大规模数据泄露。虽然有 `requireProjectAdmin`，但需确保该中间件逻辑无懈可击。
2.  **错误日志**: 在 `catch` 块中使用了 `console.error(err)`。如果 `err` 对象包含敏感 SQL 查询参数或数据库连接字符串，这些信息可能会被记录到日志文件中（如果在生产环境未重定向到安全位置）。
3.  **密码处理**: 导入学生时，如果未提供密码则生成随机密码 (L208)，但在响应中并未明确如何安全地将这些密码传递给管理员/学生。如果直接在响应中返回明文密码列表，存在传输层被截获的风险（虽然应使用 HTTPS）。

**修复建议**:
1.  确保生产环境日志脱敏。
2.  导出接口增加审计日志，记录谁导出了数据。
3.  避免在响应中批量返回生成的明文密码，建议默认设置为学号后六位或要求首次登录重置，而不是生成随机密码并返回。

### 2.3 SQLite 数据库路径遍历风险

**文件路径**: `server/lib/DatabaseManager.js` (L269)

**问题描述**:
`getProjectDbPath` 方法使用了 `projectId.replace(/[^a-zA-Z0-9-]/g, '')` 进行清理。虽然这阻止了目录遍历（如 `../`），但如果 `projectId` 生成逻辑不严谨或被绕过，可能导致文件名冲突或访问到不该访问的数据库文件。
更严重的是，**物理隔离依赖于应用层逻辑**。如果攻击者能控制 `projectId`（例如在 JWT 中伪造），就能访问任意项目的数据库。

**修复建议**:
1.  严格验证 `projectId` 是否为合法的 UUID 格式。
2.  确保 `projectId` 必须来自受信任的源（如经过签名的 JWT），绝对不能直接信任客户端传来的 `projectId` 参数（除非是登录接口，且登录后应签发包含 projectId 的 Token）。

---

## 3. 严重级别：中 (Medium)

### 3.1 弱密码策略与默认密码

**文件路径**: 
- `server/routes/admin.js` (L214)
- `server/middleware/passwordPolicy.js` (引用但未完全展示)

**问题描述**:
1.  批量导入学生时，默认密码策略可能较弱（如随机8位或默认学号）。
2.  缺乏强制首次登录修改密码的机制。学生可能长期使用默认密码，导致账号容易被盗用，进而导致选科被篡改。

**修复建议**:
1.  用户表中增加 `mustChangePassword` 字段。
2.  登录后检查此字段，如为真则强制跳转到修改密码页面。

### 3.2 缺少自动化备份机制

**文件路径**: 无（架构层面）

**问题描述**:
系统使用 SQLite 文件存储数据。如果服务器文件系统损坏或被误删，所有数据将丢失。代码中未见自动备份逻辑。

**修复建议**:
实现定时任务（Cron Job），定期将 `databases/*.db` 复制到备份目录或上传到云存储。

### 3.3 CSRF 防护策略不完善

**文件路径**: `server/middleware/csrf.js`

**问题描述**:
虽然实现了 CSRF 中间件，但在 API 设计上，如果前后端分离且使用 `Authorization: Bearer` 头传输 Token，标准 CSRF 攻击（基于 Cookie 自动发送）通常无效，因为浏览器不会自动添加自定义 Header。
然而，代码中 `csrfVerify` (L126) 允许从 `req.query._csrf` 获取 Token。这使得 Token 可能泄露在 URL 中（Referer Header 泄露），增加了风险。

**修复建议**:
禁止从 URL Query 参数中获取 CSRF Token，仅允许从 Request Header 或 Body 中获取。

---

## 4. 严重级别：低 (Low)

### 4.1 错误处理信息泄露

**文件路径**: 通用

**问题描述**:
部分 API 在 500 错误时可能返回过于详细的错误信息（虽然代码中大多统一返回了“失败”字样，但在开发模式下可能会有差异）。

**修复建议**:
统一错误处理中间件，生产环境严禁返回堆栈信息。

### 4.2 依赖安全

**文件路径**: `package.json`

**问题描述**:
未检查依赖包的漏洞情况。

**修复建议**:
定期运行 `npm audit` 检查并更新依赖。

---

## 5. 安全改进路线图

1.  **立即行动**:
    -   分离 Platform 和 Project 的 JWT 密钥。
    -   移除 `csrfVerify` 中从 query 获取 token 的逻辑。
    -   对登录和选科接口启用 Rate Limiting。

2.  **短期计划**:
    -   实施强制首次登录改密功能。
    -   完善日志系统，确保敏感数据脱敏。
    -   加强输入验证，特别是 Excel 导入部分。

3.  **长期规划**:
    -   考虑从 SQLite 迁移到 MySQL/PostgreSQL（支持更好的并发和行锁）。
    -   建立自动化备份和恢复演练机制。
    -   引入静态代码扫描工具 (SAST) 到 CI/CD 流程。

---

**报告生成时间**: 2026-02-09
**审核人**: Antigravity (AI Security Auditor)
