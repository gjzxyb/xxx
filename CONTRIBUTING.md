# 贡献指南 🤝

感谢你对学生分科自选系统的关注！我们欢迎所有形式的贡献。

## 📋 目录

- [行为准则](#行为准则)
- [如何贡献](#如何贡献)
- [开发流程](#开发流程)
- [代码规范](#代码规范)
- [提交规范](#提交规范)
- [Pull Request 流程](#pull-request-流程)
- [问题反馈](#问题反馈)

---

## 行为准则

### 我们的承诺

为了营造开放和友好的环境，我们承诺：

- 使用友好和包容的语言
- 尊重不同的观点和经验
- 优雅地接受建设性批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

### 不可接受的行为

- 使用性化的语言或图像
- 人身攻击或侮辱性评论
- 公开或私下骚扰
- 未经许可发布他人的私人信息
- 其他不道德或不专业的行为

---

## 如何贡献

### 贡献方式

你可以通过以下方式为项目做出贡献：

1. **报告 Bug** 🐛
   - 发现问题？请创建 Issue 详细描述

2. **提出功能建议** 💡
   - 有好想法？欢迎在 Issues 中讨论

3. **改进文档** 📚
   - 发现文档错误或不清晰？提交 PR 改进

4. **提交代码** 💻
   - 修复 Bug 或实现新功能

5. **代码审查** 👀
   - 帮助审查其他人的 PR

6. **测试** 🧪
   - 帮助测试新功能和修复

---

## 开发流程

### 1. Fork 项目

点击项目页面右上角的 "Fork" 按钮，将项目 fork 到你的账号下。

### 2. 克隆仓库

```bash
git clone https://github.com/your-username/xxx.git
cd xxx
```

### 3. 添加上游仓库

```bash
git remote add upstream https://github.com/original-owner/xxx.git
```

### 4. 创建分支

```bash
# 从 main 分支创建新分支
git checkout -b feature/your-feature-name

# 或修复 bug
git checkout -b fix/bug-description
```

**分支命名规范**：
- `feature/功能名称` - 新功能
- `fix/问题描述` - Bug 修复
- `docs/文档说明` - 文档更新
- `refactor/重构说明` - 代码重构
- `test/测试说明` - 测试相关

### 5. 进行开发

参考 [开发快速入门指南](GETTING_STARTED.md) 搭建开发环境。

### 6. 提交代码

```bash
git add .
git commit -m "feat: 添加新功能描述"
```

### 7. 同步上游更新

```bash
git fetch upstream
git rebase upstream/main
```

### 8. 推送到远程

```bash
git push origin feature/your-feature-name
```

### 9. 创建 Pull Request

在 GitHub 上创建 Pull Request，详细描述你的更改。

---

## 代码规范

### JavaScript 规范

#### 命名规范

```javascript
// 变量和函数：小驼峰命名
const userName = 'John';
function getUserInfo() {}

// 类：大驼峰命名
class UserManager {}

// 常量：全大写下划线分隔
const MAX_RETRY_COUNT = 3;
const API_BASE_URL = 'https://api.example.com';

// 私有变量：下划线前缀
const _privateVar = 'private';
```

#### 代码风格

```javascript
// ✅ 推荐
async function getUser(userId) {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('用户不存在');
    }
    return user;
  } catch (error) {
    console.error('获取用户失败:', error);
    throw error;
  }
}

// ❌ 不推荐
function getUser(userId, callback) {
  User.findByPk(userId, (err, user) => {
    if (err) return callback(err);
    callback(null, user);
  });
}
```

#### 注释规范

```javascript
/**
 * 获取用户信息
 * @param {number} userId - 用户ID
 * @returns {Promise<Object>} 用户对象
 * @throws {Error} 用户不存在时抛出错误
 */
async function getUserInfo(userId) {
  // 实现代码
}

// 单行注释：解释为什么这样做，而不是做了什么
// 使用事务确保数据一致性
await sequelize.transaction(async (t) => {
  // ...
});
```

### CSS 规范

```css
/* BEM 命名规范 */
.block {}
.block__element {}
.block--modifier {}

/* 示例 */
.card {}
.card__header {}
.card__body {}
.card--highlighted {}

/* 使用 CSS 变量 */
:root {
  --primary-color: #6366f1;
  --text-color: #1f2937;
}

.button {
  background-color: var(--primary-color);
  color: var(--text-color);
}
```

### 文件组织

```
server/
├── routes/           # 路由层（薄层，只做参数验证和调用）
├── controllers/      # 控制器层（业务逻辑）
├── services/         # 服务层（复杂业务逻辑）
├── models/           # 数据模型
├── middleware/       # 中间件
├── utils/            # 工具函数
└── config/           # 配置文件
```

---

## 提交规范

### Commit Message 格式

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<类型>(<范围>): <简短描述>

<详细描述>

<footer>
```

### 类型（type）

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 重构（不是新功能也不是修复）
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具链相关
- `revert`: 回滚提交

### 范围（scope）

可选，表示影响的模块：

- `auth`: 认证模块
- `selection`: 选科模块
- `admin`: 管理模块
- `ui`: 界面相关
- `db`: 数据库相关

### 示例

```bash
# 新功能
git commit -m "feat(selection): 添加选科容量实时显示"

# Bug 修复
git commit -m "fix(auth): 修复JWT过期时间计算错误"

# 文档更新
git commit -m "docs: 更新API文档中的认证说明"

# 重构
git commit -m "refactor(db): 优化数据库连接池管理"

# 性能优化
git commit -m "perf(query): 优化学生列表查询性能"

# 详细描述示例
git commit -m "feat(backup): 添加自动备份功能

- 支持定时自动备份
- 支持手动触发备份
- 自动清理旧备份文件
- 添加备份恢复功能

Closes #123"
```

---

## Pull Request 流程

### 创建 PR 前的检查清单

- [ ] 代码遵循项目的代码规范
- [ ] 已添加必要的注释
- [ ] 已更新相关文档
- [ ] 已添加或更新测试用例
- [ ] 所有测试通过
- [ ] 没有引入新的警告
- [ ] Commit message 符合规范
- [ ] 已同步最新的 main 分支

### PR 标题格式

与 Commit Message 格式相同：

```
feat(selection): 添加选科容量实时显示
fix(auth): 修复JWT过期时间计算错误
```

### PR 描述模板

```markdown
## 变更类型
- [ ] 新功能
- [ ] Bug 修复
- [ ] 文档更新
- [ ] 代码重构
- [ ] 性能优化
- [ ] 其他

## 变更说明
简要描述本次 PR 的目的和实现方式。

## 相关 Issue
Closes #123

## 测试说明
描述如何测试这些变更。

## 截图（如适用）
添加相关截图。

## 检查清单
- [ ] 代码遵循项目规范
- [ ] 已添加测试
- [ ] 所有测试通过
- [ ] 已更新文档
```

### 代码审查

PR 提交后：

1. **自动检查**：CI/CD 会自动运行测试
2. **代码审查**：至少需要 1 位维护者审查
3. **修改反馈**：根据审查意见修改代码
4. **合并**：审查通过后由维护者合并

### 审查标准

审查者会关注：

- ✅ 代码质量和可读性
- ✅ 是否遵循项目规范
- ✅ 是否有充分的测试
- ✅ 是否有安全隐患
- ✅ 性能影响
- ✅ 文档完整性

---

## 问题反馈

### 报告 Bug

创建 Issue 时请包含：

1. **Bug 描述**：清晰简洁的描述
2. **复现步骤**：详细的复现步骤
3. **期望行为**：应该发生什么
4. **实际行为**：实际发生了什么
5. **环境信息**：
   - 操作系统
   - Node.js 版本
   - 浏览器版本
6. **截图/日志**：如果适用

**Bug 报告模板**：

```markdown
## Bug 描述
简要描述问题。

## 复现步骤
1. 访问 '...'
2. 点击 '...'
3. 滚动到 '...'
4. 看到错误

## 期望行为
应该显示...

## 实际行为
实际显示...

## 环境信息
- OS: Windows 11
- Node.js: v18.16.0
- Browser: Chrome 120

## 截图
如果适用，添加截图。

## 额外信息
其他相关信息。
```

### 功能建议

创建 Issue 时请包含：

1. **功能描述**：清晰描述建议的功能
2. **使用场景**：为什么需要这个功能
3. **解决方案**：你期望的实现方式
4. **替代方案**：其他可能的实现方式

---

## 开发技巧

### 调试技巧

```javascript
// 使用 debug 模块
const debug = require('debug')('app:selection');
debug('选科数据:', selection);

// 条件断点
if (userId === 123) {
  debugger;  // 只在特定条件下断点
}
```

### 性能分析

```javascript
// 测量执行时间
console.time('查询用户');
const users = await User.findAll();
console.timeEnd('查询用户');

// 内存使用
console.log(process.memoryUsage());
```

### 测试技巧

```javascript
// 使用 describe 和 it 组织测试
describe('用户认证', () => {
  it('应该成功登录', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test', password: 'test123' });

    expect(response.status).toBe(200);
    expect(response.body.data.token).toBeDefined();
  });
});
```

---

## 获取帮助

遇到问题？

1. 查看 [开发快速入门指南](GETTING_STARTED.md)
2. 查看 [故障排查指南](TROUBLESHOOTING.md)
3. 搜索已有的 Issues
4. 在 Issues 中提问
5. 联系维护者

---

## 致谢

感谢所有贡献者的付出！你们的贡献让这个项目变得更好。

特别感谢：
- 所有提交代码的开发者
- 所有报告问题的用户
- 所有提供建议的社区成员

---

**最后更新**: 2026-02-19
**维护者**: 开发团队
