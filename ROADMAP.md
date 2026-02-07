# 后续优化功能实施计划

本文档详细规划了学生分科自选系统的后续优化功能，包括具体实施步骤、技术方案和预估工作量。

---

## 1. 密码强度策略 🔐

### 目标
增强系统安全性，确保用户密码符合安全标准。

### 实施步骤

#### 1.1 后端实现
**文件**: `server/middleware/passwordPolicy.js`

```javascript
// 密码策略配置
const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 32,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false,  // 可选
  forbiddenPatterns: ['123456', 'password', 'qwerty']
};

// 验证函数
function validatePassword(password) {
  const errors = [];
  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`密码至少需要${PASSWORD_POLICY.minLength}位`);
  }
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('需要包含大写字母');
  }
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('需要包含小写字母');
  }
  if (PASSWORD_POLICY.requireNumber && !/[0-9]/.test(password)) {
    errors.push('需要包含数字');
  }
  return { isValid: errors.length === 0, errors };
}
```

#### 1.2 前端实现
- 实时密码强度指示器（弱/中/强）
- 密码规则提示
- 密码确认输入

#### 1.3 应用场景
- 管理员设置凭据
- 学生首次登录修改密码
- 密码重置后强制修改

### 预估工作量
- 后端: 2小时
- 前端: 3小时
- 测试: 1小时

---

## 2. 操作日志记录 📝

### 目标
记录关键操作便于审计和问题追溯。

### 实施步骤

#### 2.1 数据库设计
**新增表**: `OperationLog`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| userId | INTEGER | 操作用户ID |
| userName | STRING | 用户名 |
| action | STRING | 操作类型 |
| target | STRING | 操作对象 |
| details | JSON | 详细信息 |
| ip | STRING | IP地址 |
| userAgent | STRING | 浏览器UA |
| createdAt | DATE | 操作时间 |

#### 2.2 日志类型定义
```javascript
const LOG_ACTIONS = {
  // 认证相关
  LOGIN: '用户登录',
  LOGOUT: '用户退出',
  LOGIN_FAILED: '登录失败',

  // 选科相关
  SELECTION_SUBMIT: '提交选科',
  SELECTION_MODIFY: '修改选科',
  SELECTION_CANCEL: '取消选科',

  // 管理操作
  STUDENT_CREATE: '创建学生',
  STUDENT_UPDATE: '更新学生',
  STUDENT_DELETE: '删除学生',
  STUDENT_IMPORT: '批量导入学生',
  PASSWORD_RESET: '重置密码',

  SUBJECT_CREATE: '创建科目',
  SUBJECT_UPDATE: '更新科目',
  SUBJECT_DELETE: '删除科目',

  CONFIG_UPDATE: '更新配置',
  TIME_SETTING: '设置选科时间'
};
```

#### 2.3 日志中间件
**文件**: `server/middleware/operationLog.js`

```javascript
async function logOperation(userId, action, target, details, req) {
  await OperationLog.create({
    userId,
    userName: req.user?.name,
    action,
    target,
    details: JSON.stringify(details),
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
}
```

#### 2.4 管理界面
- 新增"操作日志"标签页
- 支持按时间、用户、操作类型筛选
- 日志导出功能

### 预估工作量
- 数据库设计: 1小时
- 后端实现: 4小时
- 前端界面: 4小时
- 测试: 2小时

---

## 3. 数据自动备份 💾

### 目标
定期自动备份数据库，防止数据丢失。

### 实施步骤

#### 3.1 备份脚本
**文件**: `server/scripts/backup.js`

```javascript
const fs = require('fs');
const path = require('path');

async function backupDatabases() {
  const backupDir = path.join(__dirname, '../backups');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, timestamp);

  // 创建备份目录
  fs.mkdirSync(backupPath, { recursive: true });

  // 复制数据库文件
  const dbDir = path.join(__dirname, '../databases');
  const files = fs.readdirSync(dbDir);

  for (const file of files) {
    if (file.endsWith('.db')) {
      fs.copyFileSync(
        path.join(dbDir, file),
        path.join(backupPath, file)
      );
    }
  }

  // 清理旧备份（保留最近7天）
  cleanOldBackups(backupDir, 7);

  return backupPath;
}
```

#### 3.2 定时任务配置
**使用 node-cron 或系统定时任务**

```javascript
// server/app.js 添加
const cron = require('node-cron');
const { backupDatabases } = require('./scripts/backup');

// 每天凌晨3点执行备份
cron.schedule('0 3 * * *', async () => {
  console.log('开始自动备份...');
  const path = await backupDatabases();
  console.log('备份完成:', path);
});
```

#### 3.3 备份管理界面
- 查看备份列表
- 手动触发备份
- 下载备份文件
- 恢复数据（需谨慎）

#### 3.4 备份策略
- 每日自动备份
- 保留最近7天备份
- 支持手动备份
- 备份前检查磁盘空间

### 预估工作量
- 备份脚本: 3小时
- 定时任务: 1小时
- 管理界面: 3小时
- 测试: 2小时

---

## 4. 邮件通知功能 📧

### 目标
在关键事件发生时发送邮件通知用户。

### 实施步骤

#### 4.1 邮件服务配置
**依赖**: `nodemailer`

```bash
npm install nodemailer
```

**配置文件**: `server/config/email.js`

```javascript
module.exports = {
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  from: '"分科自选系统" <noreply@example.com>'
};
```

#### 4.2 邮件模板
**目录**: `server/templates/email/`

- `selection_confirm.html` - 选科确认
- `password_reset.html` - 密码重置
- `deadline_reminder.html` - 截止提醒
- `admin_notification.html` - 管理员通知

#### 4.3 通知场景
| 场景 | 收件人 | 触发时机 |
|------|--------|----------|
| 选科确认 | 学生 | 提交/修改选科后 |
| 密码重置 | 学生 | 密码被重置时 |
| 截止提醒 | 全体学生 | 选科截止前24小时 |
| 统计报告 | 管理员 | 选科结束后 |

#### 4.4 邮件队列（可选）
使用 Bull 队列处理大量邮件发送：

```javascript
const Queue = require('bull');
const emailQueue = new Queue('email');

emailQueue.process(async (job) => {
  await sendEmail(job.data);
});
```

### 预估工作量
- 邮件服务: 3小时
- 模板设计: 4小时
- 触发逻辑: 3小时
- 测试: 2小时

---

## 5. 移动端适配优化 📱

### 目标
优化移动设备上的用户体验。

### 实施步骤

#### 5.1 响应式断点定义
```css
/* 移动端优先 */
@media (min-width: 480px) { /* 小屏设备 */ }
@media (min-width: 768px) { /* 平板 */ }
@media (min-width: 1024px) { /* 桌面 */ }
@media (min-width: 1280px) { /* 大屏 */ }
```

#### 5.2 需要优化的页面
| 页面 | 优化内容 |
|------|----------|
| 登录页 | 全屏表单、大按钮 |
| 选科页 | 卡片堆叠布局、手势支持 |
| 仪表板 | 简化统计展示 |
| 管理后台 | 底部导航、折叠菜单 |

#### 5.3 关键优化项
- [ ] 触摸友好的按钮尺寸（至少44px）
- [ ] 底部固定操作栏
- [ ] 侧边栏转为抽屉式
- [ ] 表格改为卡片列表
- [ ] 表单字段垂直排列
- [ ] 模态框全屏显示
- [ ] 禁用不必要的悬停效果

#### 5.4 PWA支持（可选）
- 添加 manifest.json
- Service Worker 离线缓存
- 添加到主屏幕

### 预估工作量
- CSS重构: 8小时
- 组件适配: 6小时
- 测试验证: 4小时

---

## 6. 批量操作优化 ⚡

### 目标
提升大量数据处理的效率和用户体验。

### 实施步骤

#### 6.1 批量导入优化
**当前问题**: 大文件导入时页面无响应

**解决方案**:
```javascript
// 分批处理
async function importStudentsInBatches(students, batchSize = 100) {
  const total = students.length;
  let processed = 0;

  for (let i = 0; i < total; i += batchSize) {
    const batch = students.slice(i, i + batchSize);
    await User.bulkCreate(batch);
    processed += batch.length;

    // 发送进度更新
    emitProgress(processed, total);
  }
}
```

#### 6.2 进度指示器
```html
<div class="progress-container">
  <div class="progress-bar" id="importProgress"></div>
  <span id="progressText">0%</span>
</div>
```

#### 6.3 批量操作功能
- [ ] 批量删除学生（勾选后删除）
- [ ] 批量重置密码
- [ ] 批量修改班级
- [ ] 批量导出选定学生

#### 6.4 后端优化
- 使用事务处理批量操作
- 分页查询大数据集
- 索引优化

### 预估工作量
- 后端优化: 4小时
- 前端UI: 4小时
- 进度系统: 2小时
- 测试: 2小时

---

## 7. 数据可视化增强 📊

### 目标
提供更直观的数据展示和分析工具。

### 实施步骤

#### 7.1 图表库选择
**推荐**: Chart.js（轻量）或 ECharts（功能丰富）

```bash
# 使用 CDN 或
npm install chart.js
```

#### 7.2 可视化内容

**选科分布饼图**
```javascript
new Chart(ctx, {
  type: 'pie',
  data: {
    labels: ['物理', '历史'],
    datasets: [{
      data: [physicsCount, historyCount],
      backgroundColor: ['#6366f1', '#f59e0b']
    }]
  }
});
```

**组合统计柱状图**
- X轴: 选科组合
- Y轴: 人数
- 颜色区分不同科目类型

**趋势折线图**
- 每日选科人数变化
- 各科目选择趋势

#### 7.3 仪表板设计
```
┌─────────────────────────────────────┐
│  选科进度          首选分布         │
│  ████████░░ 80%   [饼图]            │
├─────────────────────────────────────┤
│  热门组合 TOP 5                      │
│  [水平柱状图]                        │
├─────────────────────────────────────┤
│  选科趋势（最近7天）                 │
│  [折线图]                            │
└─────────────────────────────────────┘
```

#### 7.4 交互功能
- 图表点击查看详情
- 数据导出
- 自定义时间范围
- 对比不同班级

### 预估工作量
- 图表组件: 6小时
- 数据接口: 3小时
- 仪表板布局: 4小时
- 测试: 2小时

---

## 总体规划

### 优先级排序
| 优先级 | 功能 | 原因 |
|--------|------|------|
| P0 | 密码强度策略 | 安全基础 |
| P0 | 操作日志记录 | 审计需求 |
| P1 | 数据自动备份 | 数据安全 |
| P1 | 移动端适配 | 用户体验 |
| P2 | 批量操作优化 | 效率提升 |
| P2 | 数据可视化 | 分析增强 |
| P3 | 邮件通知 | 可选功能 |

### 时间估算汇总
| 功能 | 后端 | 前端 | 测试 | 总计 |
|------|------|------|------|------|
| 密码强度策略 | 2h | 3h | 1h | 6h |
| 操作日志记录 | 5h | 4h | 2h | 11h |
| 数据自动备份 | 4h | 3h | 2h | 9h |
| 邮件通知功能 | 6h | 4h | 2h | 12h |
| 移动端适配 | - | 14h | 4h | 18h |
| 批量操作优化 | 4h | 6h | 2h | 12h |
| 数据可视化 | 3h | 10h | 2h | 15h |
| **总计** | 24h | 44h | 15h | **83h** |

### 建议实施顺序
1. **第一阶段（安全基础）**: 密码强度 + 操作日志 ≈ 17h
2. **第二阶段（数据保障）**: 自动备份 + 批量优化 ≈ 21h
3. **第三阶段（体验提升）**: 移动端适配 + 可视化 ≈ 33h
4. **第四阶段（增值服务）**: 邮件通知 ≈ 12h

---

**文档版本**: 1.0
**创建日期**: 2026-02-07
**作者**: 开发团队
