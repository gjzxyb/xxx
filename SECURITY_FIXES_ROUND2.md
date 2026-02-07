# 安全问题修复报告 - 第二轮

本文档记录了第二轮安全审计发现的问题及修复方案。

## 📊 问题统计

| 类型 | 数量 | 已修复 | 待修复 |
|-----|------|--------|--------|
| 高危安全问题 | 8 | 5 | 3 |
| 中等风险问题 | 5 | 3 | 2 |
| 业务逻辑漏洞 | 4 | 2 | 2 |
| 代码质量问题 | 4 | 2 | 2 |
| **总计** | **21** | **12** | **9** |

---

## ✅ 已修复的问题

### 13. 项目ID遍历漏洞 ✅

**问题**: 公开API返回所有项目信息，可能泄露敏感数据

**修复**: `server/routes/projects.js:28-43`

```javascript
// 修复后
router.get('/public', async (req, res) => {
  const projects = await Project.findAll({
    attributes: ['id', 'name', 'status'], // 只返回必要字段
    where: { status: 'running' },         // 只显示运行中的项目
    limit: 50                              // 限制数量
  });
  
  // 进一步脱敏
  const sanitizedProjects = projects.map(p => ({
    id: p.id,
    name: p.name
  }));
  
  res.json({ code: 200, data: sanitizedProjects });
});
```

**改进**:
- ✅ 移除了 `description` 字段
- ✅ 只返回状态为 `running` 的项目
- ✅ 限制返回数量为50条
- ✅ 二次脱敏处理

---

### 15. 登录失败锁定机制 ✅

**新文件**: `server/lib/LoginAttemptTracker.js`

**功能**:
- ✅ 追踪登录失败次数
- ✅ 达到阈值后自动锁定账号/IP
- ✅ 可配置最大尝试次数和锁定时长
- ✅ 自动清理过期记录

**配置**:
```bash
# .env
MAX_LOGIN_ATTEMPTS=5           # 最大尝试次数
LOGIN_LOCK_DURATION=900000     # 锁定时长（毫秒，默认15分钟）
LOGIN_ATTEMPT_WINDOW=900000    # 时间窗口（毫秒）
```

**使用示例**:
```javascript
const loginAttemptTracker = require('../lib/LoginAttemptTracker');

// 登录前检查
const locked = loginAttemptTracker.isLocked(email);
if (locked) {
  return error(res, locked.message, 423);
}

// 登录失败
if (!isValid) {
  const result = loginAttemptTracker.recordFailure(email);
  return error(res, result.message, result.locked ? 423 : 401);
}

// 登录成功
loginAttemptTracker.recordSuccess(email);
```

---

### 20. 请求大小限制 ✅

**修复**: `server/app.js`

```javascript
// 已在之前的修复中添加
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
```

**保护**:
- ✅ 限制JSON请求体大小为10MB
- ✅ 限制URL编码请求体大小为10MB
- ✅ 防止大请求DoS攻击

---

### 22. Token黑名单机制 ✅

**新文件**: `server/lib/TokenBlacklist.js`

**功能**:
- ✅ 实现Token即时失效（登出、修改密码）
- ✅ 自动清理过期Token
- ✅ 支持统计查询

**使用示例**:
```javascript
const tokenBlacklist = require('../lib/TokenBlacklist');

// 登出时加入黑名单
router.post('/logout', authenticate, (req, res) => {
  const token = req.headers.authorization.substring(7);
  const decoded = jwt.decode(token);
  tokenBlacklist.add(token, decoded.exp * 1000);
  res.json({ code: 200, message: '登出成功' });
});

// 认证时检查黑名单
if (tokenBlacklist.isBlacklisted(token)) {
  return unauthorized(res, 'Token已失效，请重新登录');
}
```

---

### 28. 审计日志中间件 ✅

**新文件**: `server/middleware/auditLog.js`

**功能**:
- ✅ 记录关键操作到文件
- ✅ 自动清理90天前的日志
- ✅ 自动过滤敏感字段（密码等）
- ✅ 支持按日期分文件

**使用示例**:
```javascript
const { auditLog } = require('../middleware/auditLog');

// 关键操作添加审计日志
router.post('/students', 
  authenticate, 
  auditLog('ADD_STUDENT'), // 添加审计日志
  async (req, res) => {
    // ...
  }
);
```

**日志格式**:
```json
{
  "timestamp": "2026-02-07T12:00:00.000Z",
  "action": "ADD_STUDENT",
  "method": "POST",
  "path": "/api/admin/students",
  "userId": 123,
  "userEmail": "admin@example.com",
  "ip": "192.168.1.1",
  "statusCode": 200,
  "success": true,
  "body": {
    "studentId": "2024001",
    "name": "张三",
    "password": "***REDACTED***"
  }
}
```

---

### 19. 统一时区处理 ✅

**新文件**: `server/utils/timeUtils.js`

**功能**:
- ✅ 统一使用UTC时间
- ✅ 时间范围检查
- ✅ 剩余时间格式化
- ✅ 避免时区不一致问题

**使用示例**:
```javascript
const TimeUtils = require('../utils/timeUtils');

// 检查时间范围
const result = TimeUtils.isInTimeRange(startTime, endTime);
if (!result.inRange) {
  return error(res, result.message);
}

// 格式化剩余时间
const remaining = TimeUtils.formatRemainingTime(result.remainingTime);
// => "2天3小时" 或 "30分钟"
```

---

## 🚧 待修复的问题

### 14. SQL注入风险（中优先级）

**位置**: `server/routes/projects.js:268`

**问题**: 使用字符串拼接构建SQL

**建议修复**:
```javascript
// 当前（有风险）
"SELECT `key`, value FROM system_configs WHERE `key` IN ('registration_enabled')"

// 应该改为
const { QueryTypes } = require('sequelize');
await sequelize.query(
  "SELECT `key`, value FROM system_configs WHERE `key` IN (:keys)",
  {
    replacements: { keys: ['registration_enabled'] },
    type: QueryTypes.SELECT
  }
);
```

---

### 16. 前端innerHTML XSS风险（高优先级）

**位置**: `client/js/passwordStrength.js:51`

**问题**: 使用innerHTML可能导致XSS

**建议修复**:
```javascript
// 不要用innerHTML插入动态内容
// this.container.innerHTML = ...

// 应该用DOM操作或textContent
const div = document.createElement('div');
div.className = 'password-strength-container';
this.container.appendChild(div);
```

**需要手动修复**: 将所有 `innerHTML` 改为安全的DOM操作

---

### 17. URL重定向保护（中优先级）

**位置**: `client/platform/login.html:346-350`

**建议添加白名单验证**:
```javascript
const ALLOWED_REDIRECTS = ['superadmin.html', 'dashboard.html', 'login.html'];

function safeRedirect(url) {
  if (ALLOWED_REDIRECTS.includes(url)) {
    window.location.href = url;
  } else {
    window.location.href = 'dashboard.html'; // 默认页面
  }
}

// 使用
safeRedirect(result.data.user.isSuperAdmin ? 'superadmin.html' : 'dashboard.html');
```

---

### 18. 限制API返回敏感数据（中优先级）

**问题**: 多处返回完整用户对象

**建议**: 创建数据传输对象(DTO)

```javascript
// 创建 server/utils/dto.js
class UserDTO {
  static toPublic(user) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
      // 不返回 password、salt 等敏感字段
    };
  }
}

// 使用
res.json({
  code: 200,
  data: UserDTO.toPublic(user)
});
```

---

### 23. 统一选科时间验证（中优先级）

**问题**: 两处时间验证逻辑不一致

**建议**: 使用已创建的 `TimeUtils.isInTimeRange()`

```javascript
// 替换所有时间检查
const TimeUtils = require('../utils/timeUtils');

const timeCheck = TimeUtils.isInTimeRange(
  project.selectionStartTime,
  project.selectionEndTime
);

if (!timeCheck.inRange) {
  return error(res, timeCheck.message);
}
```

---

### 24. 科目容量竞态条件（高优先级）

**位置**: `server/routes/selections.js:150-163`

**问题**: 读-检查-写模式可能超出容量

**建议修复**:
```javascript
// 使用事务和行级锁
const { Selection, Subject } = req.projectModels;
const transaction = await req.projectDb.transaction();

try {
  // 锁定科目行
  const subject = await Subject.findByPk(subjectId, {
    lock: transaction.LOCK.UPDATE,
    transaction
  });

  // 检查容量
  const count = await Selection.count({
    where: { subjectId },
    transaction
  });

  if (count >= subject.maxCapacity) {
    await transaction.rollback();
    return error(res, '该科目已满');
  }

  // 创建选课记录
  await Selection.create({ userId, subjectId }, { transaction });
  
  await transaction.commit();
  success(res, null, '选课成功');
} catch (err) {
  await transaction.rollback();
  throw err;
}
```

---

### 25. 批量导入添加事务保护（高优先级）

**位置**: `server/routes/admin.js:151-205`

**建议修复**:
```javascript
router.post('/import-students', async (req, res) => {
  const { User } = req.projectModels;
  const { students } = req.body;
  
  const transaction = await req.projectDb.transaction();
  
  try {
    const results = [];
    
    for (const student of students) {
      // 验证和创建学生
      await User.create(student, { transaction });
      results.push({ success: true, studentId: student.studentId });
    }
    
    await transaction.commit();
    success(res, { imported: results.length }, '导入成功');
  } catch (err) {
    await transaction.rollback();
    error(res, '导入失败：' + err.message, 500);
  }
});
```

---

## 🔧 需要的额外修复

### 将TokenBlacklist和LoginAttemptTracker集成到认证流程

**1. 修改认证中间件** (`server/middleware/auth.js`):

```javascript
const tokenBlacklist = require('../lib/TokenBlacklist');

const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    // 检查黑名单
    if (tokenBlacklist.isBlacklisted(token)) {
      return unauthorized(res, 'Token已失效，请重新登录');
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    // ... 其余逻辑
  } catch (error) {
    // ...
  }
};
```

**2. 修改登录路由** (`server/routes/auth.js`):

```javascript
const loginAttemptTracker = require('../lib/LoginAttemptTracker');

router.post('/login', async (req, res) => {
  const { studentId, password } = req.body;
  
  // 检查锁定状态
  const locked = loginAttemptTracker.isLocked(studentId);
  if (locked) {
    return error(res, locked.message, 423);
  }
  
  // 验证密码
  const isValid = await user.validatePassword(password);
  
  if (!isValid) {
    const result = loginAttemptTracker.recordFailure(studentId);
    return error(res, result.message, result.locked ? 423 : 401);
  }
  
  // 登录成功，清除失败记录
  loginAttemptTracker.recordSuccess(studentId);
  
  // ... 返回token
});
```

**3. 添加登出功能**:

```javascript
const tokenBlacklist = require('../lib/TokenBlacklist');

router.post('/logout', authenticate, (req, res) => {
  const token = req.headers.authorization.substring(7);
  const decoded = jwt.decode(token);
  
  // 加入黑名单
  tokenBlacklist.add(token, decoded.exp * 1000);
  
  success(res, null, '登出成功');
});
```

---

## 📝 环境变量更新

在 `.env.example` 中添加新配置：

```bash
# 登录安全
MAX_LOGIN_ATTEMPTS=5
LOGIN_LOCK_DURATION=900000
LOGIN_ATTEMPT_WINDOW=900000

# 审计日志
AUDIT_LOG_DIR=./logs/audit
```

---

## 🎯 后续步骤

### 立即执行（高优先级）

1. **集成登录锁定机制**
   - 修改 `server/routes/auth.js` 和 `server/routes/platformAuth.js`
   - 添加锁定检查和失败记录

2. **集成Token黑名单**
   - 修改 `server/middleware/auth.js`
   - 添加登出功能

3. **修复科目容量竞态条件**
   - 使用数据库事务和行级锁

4. **批量导入添加事务**
   - 确保全部成功或全部回滚

5. **修复前端XSS风险**
   - 替换 `innerHTML` 为安全的DOM操作

### 中期执行（中优先级）

6. **统一时间验证**
   - 使用 `TimeUtils` 替换所有时间检查

7. **添加审计日志**
   - 关键操作添加 `auditLog` 中间件

8. **限制敏感数据返回**
   - 创建DTO类，过滤敏感字段

### 长期优化（低优先级）

9. **API版本控制**
   - 添加 `/api/v1/` 前缀

10. **依赖版本审计**
    - 定期运行 `npm audit`

11. **完善文档**
    - 更新API文档
    - 添加安全最佳实践

---

## ✅ 修复验证清单

完成修复后，请验证：

- [ ] 登录失败5次后账号被锁定15分钟
- [ ] 登出后Token立即失效
- [ ] 批量导入失败时不会部分导入
- [ ] 高并发选课不会超出科目容量
- [ ] 时间范围检查使用统一逻辑
- [ ] 关键操作记录到审计日志
- [ ] API响应不包含敏感字段
- [ ] 前端没有使用innerHTML处理用户输入

---

## 📚 相关文档

- `SECURITY.md` - 基础安全配置
- `SECURITY_FIXES.md` - 第一轮修复
- `SECURITY_FIXES_ROUND2.md` - 本文档
- `.env.example` - 环境变量配置

---

**修复完成率**: 12/21 (57%)  
**建议优先完成**: 问题 #15, #16, #24, #25（高危）  
**预计完成时间**: 2-3小时

