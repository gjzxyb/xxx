# 系统架构设计文档 🏗️

本文档详细描述学生分科自选系统的技术架构、设计决策和核心组件。

## 📊 系统概览

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        客户端层                              │
├─────────────────────────────────────────────────────────────┤
│  学生端 (client/)          │  平台管理端 (platform/client/) │
│  - 登录页面                │  - 平台仪表板                  │
│  - 选科界面                │  - 项目管理                    │
│  - 个人中心                │  - 超级管理员                  │
│  - 管理后台                │                                │
└─────────────────────────────────────────────────────────────┘
                              ↓ HTTP/HTTPS
┌─────────────────────────────────────────────────────────────┐
│                        API 网关层                            │
├─────────────────────────────────────────────────────────────┤
│  Express.js 服务器                                          │
│  - CORS 跨域处理                                            │
│  - Helmet 安全头                                            │
│  - 速率限制                                                 │
│  - 请求日志                                                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                        中间件层                              │
├─────────────────────────────────────────────────────────────┤
│  认证中间件          │  CSRF保护         │  数据库注入      │
│  - JWT验证           │  - Token生成      │  - 动态加载DB    │
│  - 权限检查          │  - Token验证      │  - 模型注入      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                        业务逻辑层                            │
├─────────────────────────────────────────────────────────────┤
│  路由控制器 (routes/)                                       │
│  ├── auth.js          - 认证相关                            │
│  ├── subjects.js      - 科目管理                            │
│  ├── selections.js    - 选科操作                            │
│  ├── admin.js         - 管理员功能                          │
│  ├── projects.js      - 项目管理                            │
│  └── superadmin.js    - 超级管理员                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                        数据访问层                            │
├─────────────────────────────────────────────────────────────┤
│  Sequelize ORM                                              │
│  ├── 平台级模型 (models/platform/)                          │
│  │   ├── Project.js      - 项目信息                         │
│  │   └── PlatformUser.js - 平台用户                         │
│  └── 项目级模型 (models/project/)                           │
│      ├── User.js          - 学生/管理员                      │
│      ├── Subject.js       - 科目信息                         │
│      ├── Selection.js     - 选科记录                         │
│      └── SelectionConfig.js - 选科配置                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                        数据存储层                            │
├─────────────────────────────────────────────────────────────┤
│  SQLite 数据库（物理隔离）                                   │
│  ├── platform.db          - 平台数据库                       │
│  └── project_{uuid}.db    - 各项目独立数据库                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 核心设计理念

### 1. 多租户架构（物理隔离）

**设计目标**：为每个学校/项目提供完全独立的数据存储，确保数据安全和隐私。

**实现方式**：
- 每个项目拥有独立的 SQLite 数据库文件
- 数据库文件命名：`project_{uuid}.db`
- 运行时根据 `projectId` 动态加载对应数据库

**优势**：
- ✅ 数据完全物理隔离，无跨项目访问风险
- ✅ 单个项目故障不影响其他项目
- ✅ 便于数据备份和迁移
- ✅ 符合数据主权和隐私法规要求

**劣势**：
- ⚠️ 无法跨项目查询统计
- ⚠️ 数据库连接池管理复杂度增加

### 2. 双层数据库设计

#### 平台数据库 (platform.db)
存储跨项目的全局数据：
- 项目列表和元信息
- 平台管理员账号
- 系统级配置

#### 项目数据库 (project_{uuid}.db)
存储项目特定数据：
- 学生和管理员账号
- 科目信息
- 选科记录
- 项目配置

### 3. 中间件驱动架构

**请求处理流程**：
```javascript
请求 → CORS → Helmet → 速率限制
    → JWT认证 → CSRF验证 → 项目DB注入
    → 路由处理器 → 响应
```

**关键中间件**：

#### authenticateProject (auth.js)
```javascript
// 验证JWT并提取projectId
const token = req.headers.authorization?.split(' ')[1];
const decoded = jwt.verify(token, JWT_SECRET);
req.user = decoded;
req.projectId = decoded.projectId;
```

#### projectDb (projectDb.js)
```javascript
// 动态加载项目数据库模型
const models = await DatabaseManager.getProjectModels(projectId);
req.projectModels = models;
```

#### csrfProtection (csrf.js)
```javascript
// 验证CSRF Token
const token = req.headers['x-csrf-token'];
if (!verifyCsrfToken(token)) {
  return res.status(403).json({ code: 403, message: 'CSRF验证失败' });
}
```

---

## 🔐 安全架构

### 认证与授权

#### JWT 双层认证体系

**平台级认证**：
- 密钥：`PLATFORM_JWT_SECRET`
- 用途：平台管理员登录
- 有效期：24小时
- Payload：`{ userId, email, role: 'platform_admin' }`

**项目级认证**：
- 密钥：`JWT_SECRET`
- 用途：学生和项目管理员登录
- 有效期：24小时
- Payload：`{ userId, projectId, role: 'admin'|'student' }`

#### 权限控制

```javascript
// 权限检查中间件
function requireProjectAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ code: 403, message: '需要管理员权限' });
  }
  next();
}

function requirePlatformAdmin(req, res, next) {
  if (req.user.role !== 'platform_admin') {
    return res.status(403).json({ code: 403, message: '需要平台管理员权限' });
  }
  next();
}
```

### CSRF 保护

**实现机制**：
1. 用户登录后生成 CSRF Token
2. Token 存储在内存中（或 Redis）
3. 前端在请求头中携带 Token
4. 后端验证 Token 有效性

**保护范围**：
- ✅ 所有 POST/PUT/DELETE 请求
- ❌ GET 请求不需要 CSRF 保护

### 速率限制

**登录限制**：
- 5次失败尝试 / 15分钟 / IP
- 防止暴力破解

**选科提交限制**：
- 3次提交 / 分钟 / 用户
- 防止恶意刷新

**Excel导出限制**：
- 10次导出 / 小时 / 用户
- 防止资源滥用

### 数据脱敏

**日志脱敏**：
```javascript
function sanitizeLog(data) {
  const sensitive = ['password', 'token', 'secret', 'jwt'];
  // 自动替换敏感字段为 '***'
}
```

**导出脱敏**：
- Excel 导出不包含密码字段
- 仅导出必要的业务数据

---

## 💾 数据库架构

### DatabaseManager 核心类

**职责**：
- 管理多个数据库连接
- 动态加载项目数据库
- 缓存数据库实例
- 处理数据库初始化

**关键方法**：

```javascript
class DatabaseManager {
  // 获取平台数据库
  static async getPlatformDb() {
    if (!platformDb) {
      platformDb = new Sequelize({
        dialect: 'sqlite',
        storage: './databases/platform.db'
      });
      await this.initPlatformModels(platformDb);
    }
    return platformDb;
  }

  // 获取项目数据库模型
  static async getProjectModels(projectId) {
    // 验证 projectId 格式（防止路径遍历）
    if (!isValidUUID(projectId)) {
      throw new Error('Invalid projectId format');
    }

    // 检查缓存
    if (projectDbCache[projectId]) {
      return projectDbCache[projectId];
    }

    // 创建新连接
    const sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: `./databases/project_${projectId}.db`
    });

    // 初始化模型
    const models = await this.initProjectModels(sequelize);

    // 缓存
    projectDbCache[projectId] = models;

    return models;
  }
}
```

### 数据模型关系

#### 平台级模型

```
PlatformUser (平台管理员)
    ↓ 1:N
Project (项目)
```

#### 项目级模型

```
User (学生/管理员)
    ↓ 1:1
Selection (选科记录)
    ↓ N:1
Subject (科目)

SelectionConfig (配置表)
    - 独立存在，无外键关联
```

### 数据完整性

**外键约束**：
```javascript
Selection.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });
Selection.belongsTo(Subject, { foreignKey: 'firstChoiceId', as: 'firstChoice' });
Selection.belongsTo(Subject, { foreignKey: 'secondChoiceId', as: 'secondChoice' });
Selection.belongsTo(Subject, { foreignKey: 'thirdChoiceId', as: 'thirdChoice' });
```

**级联删除**：
- 删除学生 → 自动删除其选科记录
- 删除项目 → 手动删除数据库文件

**唯一性约束**：
- 学号在项目内唯一
- 用户在项目内只能有一条选科记录

---

## 🔄 业务流程

### 选科流程

```
1. 学生登录
   ↓
2. 检查选科时间窗口
   ↓ (开放中)
3. 获取可选科目列表
   ↓
4. 选择科目（1个首选 + 2个再选）
   ↓
5. 验证容量限制
   ↓ (有容量)
6. 提交选科
   ↓
7. 更新科目已选人数
   ↓
8. 返回成功
```

**并发控制**：
```javascript
// 使用事务确保原子性
await sequelize.transaction(async (t) => {
  // 1. 检查容量
  const subject = await Subject.findByPk(subjectId, {
    lock: t.LOCK.UPDATE,  // 行级锁
    transaction: t
  });

  if (subject.selectedCount >= subject.capacity) {
    throw new Error('科目已满');
  }

  // 2. 创建选科记录
  await Selection.create(data, { transaction: t });

  // 3. 更新已选人数
  await subject.increment('selectedCount', { transaction: t });
});
```

### 项目创建流程

```
1. 平台管理员登录
   ↓
2. 填写项目信息
   ↓
3. 生成 UUID
   ↓
4. 创建项目数据库文件
   ↓
5. 初始化数据表
   ↓
6. 插入默认科目模板
   ↓
7. 保存项目记录到平台数据库
   ↓
8. 返回项目ID
```

---

## 📦 模块设计

### 备份模块 (utils/backup.js)

**功能**：
- 定时自动备份
- 手动触发备份
- 备份文件管理
- 数据恢复

**实现**：
```javascript
class BackupManager {
  // 创建备份
  async createBackup() {
    const timestamp = new Date().toISOString();
    const backupPath = `./backups/backup_${timestamp}.zip`;

    // 使用 archiver 压缩数据库文件
    const archive = archiver('zip', { zlib: { level: 9 } });
    const output = fs.createWriteStream(backupPath);

    archive.pipe(output);
    archive.directory('./databases/', 'databases');
    await archive.finalize();

    // 清理旧备份
    await this.cleanOldBackups();

    return backupPath;
  }

  // 定时任务
  startSchedule() {
    const schedule = process.env.BACKUP_SCHEDULE || '0 3 * * *';
    cron.schedule(schedule, () => {
      this.createBackup();
    });
  }
}
```

### 日志模块 (utils/logger.js)

**功能**：
- 分级日志（info/warn/error）
- 日志轮转
- 敏感信息脱敏

**实现**：
```javascript
const rfs = require('rotating-file-stream');

const accessLogStream = rfs.createStream('access.log', {
  interval: '1d',      // 每天轮转
  maxFiles: 30,        // 保留30天
  path: './logs'
});

function sanitize(data) {
  // 脱敏处理
  return JSON.stringify(data).replace(
    /"(password|token|secret)":"[^"]*"/g,
    '"$1":"***"'
  );
}
```

---

## 🚀 性能优化

### 数据库优化

**索引策略**：
```javascript
// 学号索引（高频查询）
User.addIndex(['studentId']);

// 科目代码索引
Subject.addIndex(['code']);

// 选科记录复合索引
Selection.addIndex(['userId', 'submittedAt']);
```

**查询优化**：
```javascript
// 使用 attributes 限制返回字段
User.findAll({
  attributes: ['id', 'name', 'studentId', 'className'],
  // 不返回 password 字段
});

// 使用 include 预加载关联数据（避免 N+1 查询）
Selection.findAll({
  include: [
    { model: Subject, as: 'firstChoice' },
    { model: Subject, as: 'secondChoice' },
    { model: Subject, as: 'thirdChoice' }
  ]
});
```

### 缓存策略

**数据库连接缓存**：
```javascript
const projectDbCache = new Map();

// 缓存项目数据库连接
if (projectDbCache.has(projectId)) {
  return projectDbCache.get(projectId);
}
```

**静态资源缓存**：
```javascript
// Express 静态文件缓存
app.use(express.static('client', {
  maxAge: '1d',  // 缓存1天
  etag: true
}));
```

---

## 🔧 可扩展性设计

### 水平扩展

**当前限制**：
- SQLite 不支持多进程写入
- 单机部署

**扩展方案**：
1. **迁移到 PostgreSQL/MySQL**
   - 支持多进程并发
   - 更好的性能和扩展性

2. **使用 Redis 缓存**
   - 缓存热点数据
   - 减轻数据库压力

3. **负载均衡**
   - Nginx 反向代理
   - PM2 集群模式

### 垂直扩展

**优化方向**：
- 增加服务器内存（提升数据库缓存）
- 使用 SSD 存储（提升 I/O 性能）
- 升级 CPU（提升并发处理能力）

---

## 📊 监控与运维

### 健康检查

```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});
```

### 性能指标

**关键指标**：
- API 响应时间
- 数据库查询时间
- 并发用户数
- 错误率

**监控工具**：
- PM2 监控面板
- 自定义日志分析
- 第三方 APM 工具（如 New Relic）

---

## 🔮 未来架构演进

### 短期优化（3-6个月）

1. **引入 Redis**
   - 会话存储
   - CSRF Token 存储
   - 热点数据缓存

2. **操作日志系统**
   - 记录关键操作
   - 审计追踪

3. **邮件通知服务**
   - 异步队列处理
   - 邮件模板管理

### 中期演进（6-12个月）

1. **微服务拆分**
   - 认证服务
   - 选科服务
   - 统计服务

2. **消息队列**
   - RabbitMQ / Kafka
   - 异步任务处理

3. **数据库迁移**
   - PostgreSQL 主库
   - 读写分离

### 长期规划（1-2年）

1. **云原生架构**
   - Docker 容器化
   - Kubernetes 编排

2. **大数据分析**
   - 选科趋势分析
   - 智能推荐系统

3. **移动端 App**
   - React Native / Flutter
   - 原生体验

---

## 📚 参考资料

- [Express.js 官方文档](https://expressjs.com/)
- [Sequelize ORM 文档](https://sequelize.org/)
- [SQLite 文档](https://www.sqlite.org/docs.html)
- [JWT 最佳实践](https://tools.ietf.org/html/rfc8725)
- [OWASP 安全指南](https://owasp.org/)

---

**文档版本**: 1.0.0
**最后更新**: 2026-02-19
**维护者**: 架构团队
