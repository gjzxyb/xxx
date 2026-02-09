# 代码安全审计报告（深度版）

**项目名称**: 学生分科自选系统  
**审计日期**: 2026-02-09  
**审计范围**: 全代码库深度审计  
**审计版本**: 二次审计（深度分析）

---

## 执行摘要

本次深度审计在前次审计基础上，对代码进行了更细致的安全分析。整体而言，项目在安全方面做了大量工作，但仍存在一些需要关注的问题。

### 安全状况总评

| 维度 | 评分 | 说明 |
|------|------|------|
| 认证与授权 | ⭐⭐⭐⭐ | JWT实现基本正确，但有密钥混用风险 |
| 输入验证 | ⭐⭐⭐⭐⭐ | 使用express-validator，验证全面 |
| 速率限制 | ⭐⭐⭐⭐⭐ | 多层防护，配置合理 |
| 密码策略 | ⭐⭐⭐⭐⭐ | 强度检查完善 |
| 错误处理 | ⭐⭐⭐⭐ | 统一处理，生产环境安全 |
| 日志审计 | ⭐⭐⭐⭐ | 有审计日志，但覆盖不全 |
| CSRF防护 | ⭐⭐⭐ | 有实现但存在隐患 |
| 数据隔离 | ⭐⭐⭐⭐⭐ | 物理隔离实现良好 |

---

## 1. 严重问题 (Critical)

### 1.1 JWT密钥混用风险 ⚠️

**文件位置**:
- `server/middleware/auth.js` (L8-18)
- `server/middleware/projectAuth.js` (L8-13)
- `platform/server/middleware/auth.js` (L4-10)

**详细分析**:
1. **server/middleware/auth.js** (L8-18): 开发环境会生成临时密钥
   ```javascript
   const JWT_SECRET = process.env.JWT_SECRET || (() => {
     if (process.env.NODE_ENV === 'production') {
       console.error('❌ 严重错误: 生产环境必须设置JWT_SECRET环境变量！');
       process.exit(1);
     }
     // 开发环境生成临时随机密钥
     const tempSecret = crypto.randomBytes(32).toString('hex');
     return tempSecret;
   })();
   ```

2. **server/middleware/projectAuth.js** (L8-13): 强制检查
   ```javascript
   if (!process.env.JWT_SECRET) {
     console.error('错误: 未设置JWT_SECRET环境变量');
     process.exit(1);
   }
   ```

3. **platform/server/middleware/auth.js** (L4-10): 强制检查
   ```javascript
   const JWT_SECRET = process.env.JWT_SECRET;
   if (!JWT_SECRET) {
     console.error('❌ 致命错误: JWT_SECRET未配置！');
     process.exit(1);
   }
   ```

**风险描述**:
- 所有模块使用同一个 `JWT_SECRET` 环境变量
- Token结构相似（都包含 `userId`），可能导致**跨系统Token重用攻击**
- 例如：使用Project A的Token访问Platform API，如果被接受则造成严重安全漏洞

**验证结果**: 
- ✅ `server/middleware/auth.js` 和 `platform/server/middleware/auth.js` 都验证JWT但未验证token来源
- ✅ 两个系统的Token payload结构类似：`{ userId: ... }`

**修复建议**:
```javascript
// 分离密钥配置
const PROJECT_JWT_SECRET = process.env.PROJECT_JWT_SECRET;
const PLATFORM_JWT_SECRET = process.env.PLATFORM_JWT_SECRET;

// Token payload应包含来源标识
const generateProjectToken = (user) => {
  return jwt.sign(
    { userId: user.id, type: 'project', projectId: user.projectId },
    PROJECT_JWT_SECRET,
    { expiresIn: '2h' }
  );
};

// 验证时检查来源
const authenticateProject = (req, res, next) => {
  const decoded = jwt.verify(token, PROJECT_JWT_SECRET);
  if (decoded.type !== 'project') {
    return unauthorized(res, 'Token类型不匹配');
  }
  // ...
};
```

---

### 1.2 CSRF Token URL泄露风险 ⚠️

**文件位置**: `server/middleware/csrf.js` (L117-128)

**代码分析**:
```javascript
function csrfVerify(req, res, next) {
  // GET、HEAD、OPTIONS 请求不需要验证
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const sessionId = req.user?.id || req.ip;
  
  // 从请求头或请求体获取 token - ⚠️ 也允许从query获取！
  const token = req.headers['x-csrf-token'] || 
                req.body?._csrf || 
                req.query?._csrf;  // ← 风险点

  if (!token) {
    return res.status(403).json({ code: 403, message: 'CSRF token 缺失' });
  }
  // ...
}
```

**风险描述**:
- 允许从 `req.query._csrf` 获取Token
- Token可能出现在URL中（如分享链接、浏览器历史、Referer头）
- 攻击者可通过Referer头窃取CSRF Token

**验证场景**:
```
// 恶意场景：用户点击包含CSRF token的链接
https://attacker.com?stolen_token=abc123&_csrf=VICTIM_CSRF_TOKEN
// Referer头将泄露CSRF Token
```

**修复建议**:
```javascript
function csrfVerify(req, res, next) {
  // 禁止从URL query获取Token
  const token = req.headers['x-csrf-token'] || req.body?._csrf;
  
  if (!token) {
    return res.status(403).json({ 
      code: 403, 
      message: 'CSRF token 缺失，请从请求头或请求体传递' 
    });
  }
  // ...
}
```

---

## 2. 高危问题 (High)

### 2.1 敏感信息泄露（.env文件）⚠️

**文件位置**: `server/.env` (L134-135)

**发现问题**:
```bash
EMAIL_USER=pgzxo1@126.com
EMAIL_PASSWORD=VY2GE36eMVLfyjeS
```

**风险描述**:
- 真实的邮箱SMTP密码暴露在代码库中
- 尽管.env文件在.gitignore中，但历史提交可能仍包含敏感信息
- 攻击者可使用此邮箱发送钓鱼邮件或垃圾邮件

**修复建议**:
1. **立即行动**:
   ```bash
   # 1. 修改邮箱密码
   # 2. 从Git历史删除敏感信息
   git filter-branch --force --index-filter \
     'git rm --cached --ignore-unmatch server/.env' \
     HEAD
   # 3. 强制推送（注意：这会改写历史）
   git push origin --force --all
   ```

2. **长期措施**:
   - 使用环境变量或密钥管理服务（如AWS Secrets Manager, HashiCorp Vault）
   - 将 `.env` 添加到 `.gitignore` 并创建 `.env.example` 模板

---

### 2.2 SQLite并发性能瓶颈

**文件位置**: `server/routes/selections.js` (L161-165)

**代码分析**:
```javascript
// 使用事务和行锁防止并发竞态条件
const sequelize = Selection.sequelize;
const transaction = await sequelize.transaction({
  isolationLevel: require('sequelize').Transaction.ISOLATION_LEVELS.SERIALIZABLE
});
```

**风险描述**:
- SQLite使用文件级锁，高并发下`SERIALIZABLE`会导致严重性能问题
- 大量`SQLITE_BUSY`错误可能导致选科失败
- 缺乏降级策略（如自动重试、队列机制）

**建议**:
1. 添加重试机制
2. 考虑迁移到PostgreSQL/MySQL以支持真正的行级锁
3. 或实现内存队列进行请求串行化处理

---

### 2.3 审计日志覆盖不全

**文件位置**: `server/middleware/auditLog.js`

**分析**:
- 审计日志中间件存在但未在所有关键路由应用
- 敏感操作（如密码重置、批量导入、删除用户）可能未被记录

**建议**:
在以下路由添加审计日志：
- 管理员重置学生密码
- 批量导入学生
- 删除学生
- 修改选科时间设置
- 超级管理员操作（禁用/删除用户）

---

## 3. 中危问题 (Medium)

### 3.1 密码重置后明文返回

**文件位置**: `server/routes/admin.js` (L359-371)

**代码分析**:
```javascript
router.post('/students/:id/reset-password', authenticateProject, requireProjectAdmin, async (req, res) => {
  // ...
  const newPassword = crypto.randomBytes(8).toString('hex');
  await student.update({ password: newPassword });

  // ⚠️ 返回明文密码
  success(res, { 
    studentId: student.studentId,
    newPassword: newPassword  // ← 明文返回
  }, '密码已重置成功');
});
```

**风险**:
- 明文密码在响应中传输，虽使用HTTPS但仍存在风险
- 日志系统可能记录响应内容，导致密码泄露

**修复建议**:
```javascript
// 方案1: 不返回密码，要求管理员告知学生
success(res, { 
  studentId: student.studentId,
  message: '密码已重置，请告知学生使用临时密码登录并修改'
}, '密码已重置成功');

// 方案2: 设置必须修改密码标记
await student.update({ 
  password: newPassword,
  mustChangePassword: true  // 强制首次登录修改
});
```

---

### 3.2 Token黑名单内存存储

**文件位置**: `server/lib/TokenBlacklist.js`

**分析**:
- 使用内存Map存储黑名单Token
- 服务器重启后所有黑名单丢失
- 分布式部署时无法共享黑名单

**建议**:
虽然代码注释提到"生产环境应使用Redis"，但应明确检查：
```javascript
// 在应用启动时检查
if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL) {
  console.warn('⚠️ 警告: 生产环境建议配置Redis以实现Token黑名单持久化');
}
```

---

### 3.3 验证码存储内存限制

**文件位置**: `platform/server/routes/auth.js` (L7)

**代码分析**:
```javascript
// 验证码存储（简单内存存储，生产环境应使用 Redis）
const captchaStore = new Map();
```

**风险**:
- 验证码存储在内存中，服务器重启丢失
- 无大小限制，可能内存泄漏
- 分布式部署无法共享

**修复建议**:
- 添加验证码数量限制（如最多10000个）
- 配置Redis存储

---

## 4. 低危问题 (Low)

### 4.1 代码重复问题

**文件位置**: `server/middleware/passwordPolicy.js`

**分析**:
- 文件包含两个独立的密码策略实现
- 第1-75行: 旧版实现
- 第143-348行: 新版增强实现
- 两个`validatePasswordMiddleware`函数定义，第二个会覆盖第一个

**建议**:
清理重复代码，保留新版实现。

---

### 4.2 CORS配置警告

**文件位置**: `server/app.js` (L66-86)

**分析**:
```javascript
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);  // ← 允许无origin请求
    // ...
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      if (process.env.NODE_ENV === 'production') {
        callback(new Error(`来源 ${origin} 不在允许列表中`));
      } else {
        console.warn(`⚠️  警告: 来源 ${origin} 不在允许列表中，但开发环境允许访问`);
        callback(null, true);  // ← 开发环境允许所有
      }
    }
  },
  // ...
}));
```

**风险**:
- 开发环境允许所有来源，可能导致开发者误将配置带到生产环境

**建议**:
```javascript
// 强制生产环境严格检查
if (process.env.NODE_ENV === 'production') {
  if (!process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS.includes('*')) {
    console.error('❌ 生产环境不允许使用通配符CORS配置');
    process.exit(1);
  }
}
```

---

### 4.3 健康检查端点暴露过多信息

**文件位置**: `server/app.js` (L144-146)

**分析**:
```javascript
app.get('/api/health', (req, res) => {
  res.json({ code: 200, message: 'Server is running', data: { time: new Date().toISOString() } });
});
```

**建议**:
健康检查端点应最小化信息暴露：
```javascript
app.get('/api/health', (req, res) => {
  res.status(200).send('OK');  // 最小化响应
});
```

---

## 5. 正面安全实践 ✅

### 5.1 完善的速率限制

**文件位置**: `server/middleware/rateLimit.js`

**亮点**:
- 多层级速率限制（登录、注册、选科、导出）
- 自定义keyGenerator基于IP+用户标识
- 合理的限制策略

```javascript
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5,
  keyGenerator: (req) => {
    const ip = req.ip || req.connection.remoteAddress;
    const projectId = req.body.projectId || req.query.projectId || '';
    return `login:${ip}:${projectId}`;
  }
});
```

### 5.2 强密码策略

**文件位置**: `server/middleware/passwordPolicy.js` (第143-348行)

**亮点**:
- 长度、复杂度检查
- 禁止常见弱密码
- 禁止学号作为密码
- 检查连续/重复字符

### 5.3 登录失败锁定机制

**文件位置**: `server/lib/LoginAttemptTracker.js`

**亮点**:
- 支持内存和Redis双模式
- 可配置锁定时间和最大尝试次数
- 自动清理过期记录
- 提供解锁脚本

### 5.4 输入验证完善

**文件位置**: `server/middleware/validation.js`

**亮点**:
- 使用express-validator
- 全面的验证规则（登录、注册、选科、科目等）
- 分页参数验证
- 时间设置验证

### 5.5 错误处理安全

**文件位置**: `server/middleware/errorHandler.js`

**亮点**:
- 生产环境不暴露堆栈信息
- 统一错误响应格式
- 区分开发/生产环境日志
- 处理Sequelize特定错误

### 5.6 审计日志脱敏

**文件位置**: `server/middleware/auditLog.js` (L116-129)

**亮点**:
```javascript
function sanitizeBody(body) {
  const sensitiveFields = ['password', 'newPassword', 'oldPassword', 'token', 'captchaAnswer'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  });
}
```

### 5.7 数据库路径安全

**文件位置**: `server/lib/DatabaseManager.js` (L96-124)

**亮点**:
```javascript
validateProjectId(projectId) {
  // UUID v4格式验证
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  // 路径遍历字符检查
  const dangerousChars = ['..', '/', '\\', '\0', '%00'];
  for (const char of dangerousChars) {
    if (projectId.includes(char)) {
      throw new Error('Security violation: path traversal attempt detected');
    }
  }
}
```

---

## 6. 安全改进建议

### 立即执行（24小时内）

1. **修改邮箱密码** - `.env`中的邮箱密码已暴露
2. **分离JWT密钥** - 为Platform和Project配置不同的JWT_SECRET
3. **修复CSRF URL泄露** - 移除`req.query._csrf`支持

### 短期执行（1周内）

1. **清理Git历史** - 移除敏感信息的历史提交
2. **添加审计日志** - 覆盖所有敏感操作
3. **密码重置优化** - 不返回明文密码或添加`mustChangePassword`标记
4. **配置Redis** - 生产环境启用Redis用于Token黑名单和验证码存储

### 长期规划（1个月内）

1. **数据库迁移** - 考虑从SQLite迁移到PostgreSQL以支持高并发
2. **添加安全扫描** - 集成`npm audit`到CI/CD流程
3. **定期渗透测试** - 每季度进行一次安全测试
4. **安全培训** - 开发团队安全意识培训

---

## 7. 修复代码示例

### 7.1 分离JWT密钥配置

创建 `server/config/jwt.js`:
```javascript
const jwt = require('jsonwebtoken');

// 分离的密钥配置
const JWT_SECRETS = {
  project: process.env.PROJECT_JWT_SECRET,
  platform: process.env.PLATFORM_JWT_SECRET
};

// 启动时验证
function validateJwtConfig() {
  for (const [type, secret] of Object.entries(JWT_SECRETS)) {
    if (!secret) {
      console.error(`❌ 错误: ${type}的JWT_SECRET未配置`);
      process.exit(1);
    }
    if (secret.length < 32) {
      console.error(`❌ 错误: ${type}的JWT_SECRET太短（至少32位）`);
      process.exit(1);
    }
  }
}

// 生成Token时添加类型标识
function generateToken(payload, type) {
  return jwt.sign(
    { ...payload, tokenType: type },
    JWT_SECRETS[type],
    { expiresIn: type === 'project' ? '2h' : '7d' }
  );
}

// 验证Token时检查类型
function verifyToken(token, expectedType) {
  const secret = JWT_SECRETS[expectedType];
  const decoded = jwt.verify(token, secret);
  
  if (decoded.tokenType !== expectedType) {
    throw new Error('Token类型不匹配');
  }
  
  return decoded;
}

module.exports = { validateJwtConfig, generateToken, verifyToken };
```

### 7.2 安全的CSRF中间件

修改 `server/middleware/csrf.js`:
```javascript
function csrfVerify(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // 禁止从URL获取Token
  const token = req.headers['x-csrf-token'] || req.body?._csrf;
  
  if (!token) {
    return res.status(403).json({
      code: 403,
      message: 'CSRF token缺失，请从请求头(X-CSRF-Token)或请求体(_csrf)传递'
    });
  }

  // ... 验证逻辑
}
```

### 7.3 安全的密码重置

修改 `server/routes/admin.js`:
```javascript
router.post('/students/:id/reset-password', authenticateProject, requireProjectAdmin, async (req, res) => {
  // ...
  const newPassword = crypto.randomBytes(8).toString('hex');
  
  await student.update({
    password: newPassword,
    mustChangePassword: true,  // 强制修改密码
    passwordChangedAt: new Date()
  });

  // 不返回密码，只返回确认信息
  success(res, {
    studentId: student.studentId,
    name: student.name,
    message: '密码已重置为临时密码，学生首次登录时必须修改密码'
  }, '密码重置成功');
});
```

---

## 8. 总结

### 安全状况

**优点**:
- ✅ 多层速率限制保护
- ✅ 完善的密码策略
- ✅ 登录失败锁定机制
- ✅ 数据物理隔离
- ✅ 统一错误处理
- ✅ 输入验证全面

**需要改进**:
- ⚠️ JWT密钥混用风险
- ⚠️ 敏感信息泄露（.env）
- ⚠️ CSRF Token URL泄露
- ⚠️ 审计日志覆盖不全
- ⚠️ SQLite并发瓶颈

### 风险等级分布

| 级别 | 数量 | 状态 |
|------|------|------|
| 🔴 Critical | 2 | 需立即修复 |
| 🟠 High | 3 | 建议本周修复 |
| 🟡 Medium | 3 | 计划修复 |
| 🟢 Low | 3 | 可延期 |

### 最后建议

该项目在安全方面已经做了大量工作，整体架构安全合理。主要风险集中在配置管理和一些细节实现上。建议优先处理Critical级别问题，然后逐步改进其他问题。

定期（每季度）进行代码审计和安全测试是保持系统安全的最佳实践。

---

**报告生成时间**: 2026-02-09  
**审核人**: AI Security Auditor  
**报告版本**: 2.0 (深度审计版)
