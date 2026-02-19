# 开发快速入门指南 🚀

欢迎加入学生分科自选系统的开发！本指南将帮助你快速搭建开发环境并开始贡献代码。

## 📋 前置要求

### 必需软件
- **Node.js**: >= 18.0.0 ([下载地址](https://nodejs.org/))
- **npm**: >= 9.0.0 (随 Node.js 安装)
- **Git**: 最新版本 ([下载地址](https://git-scm.com/))

### 推荐工具
- **代码编辑器**: VS Code / WebStorm
- **API 测试**: Postman / Insomnia
- **数据库查看**: DB Browser for SQLite

---

## 🛠️ 环境搭建

### 1. 克隆项目

```bash
# 克隆仓库
git clone <repository-url>
cd xxx

# 查看当前分支
git branch
```

### 2. 安装依赖

```bash
# 安装服务端依赖
cd server
npm install

# 安装平台端依赖（如果有）
cd ../platform
npm install
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件
# Windows: notepad .env
# Mac/Linux: nano .env
```

**开发环境最小配置**：
```env
# 开发环境
NODE_ENV=development

# JWT密钥（开发环境可以使用简单值）
JWT_SECRET=dev-secret-key-change-in-production
PLATFORM_JWT_SECRET=dev-platform-secret-key
CSRF_SECRET=dev-csrf-secret-key

# 管理员账号（首次启动创建）
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin123456
ADMIN_NAME=开发管理员

# CORS（开发环境允许本地访问）
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# 备份配置（开发环境可选）
BACKUP_ENABLED=false

# 速率限制（开发环境可以禁用）
SKIP_RATE_LIMIT=true
```

### 4. 初始化数据库

```bash
# 启动服务器（首次启动会自动创建数据库）
cd server
npm start
```

首次启动会看到：
```
✓ 平台数据库已同步
✓ 默认超级管理员已创建
  邮箱: admin@example.com
  密码: Admin123456
✓ 默认科目模板已创建
========================================
  学生分科自选系统 (内嵌式 SaaS)
========================================
  系统访问: http://localhost:3000
  平台管理: http://localhost:3000/platform
  API地址:  http://localhost:3000/api
========================================
```

### 5. 验证安装

打开浏览器访问：
- **平台管理**: http://localhost:3000/platform/dashboard.html
- **登录页面**: http://localhost:3000/

使用管理员账号登录验证功能正常。

---

## 📁 项目结构

```
d:\xxx\
├── client/                 # 学生端前端
│   ├── css/
│   │   └── style.css      # 全局样式
│   ├── js/
│   │   └── api.js         # API工具函数
│   ├── index.html         # 登录页
│   ├── dashboard.html     # 学生仪表板
│   ├── selection.html     # 选科页面
│   └── admin.html         # 管理后台
│
├── platform/              # 平台管理端
│   ├── client/
│   │   ├── css/
│   │   ├── js/
│   │   └── *.html
│   └── package.json
│
├── server/                # 后端服务
│   ├── app.js            # 应用入口
│   ├── config/           # 配置文件
│   │   └── database.js
│   ├── lib/
│   │   └── DatabaseManager.js  # 多数据库管理器
│   ├── models/           # 数据模型
│   │   ├── platform/     # 平台级模型
│   │   └── project/      # 项目级模型
│   ├── middleware/       # 中间件
│   │   ├── auth.js       # JWT认证
│   │   ├── projectDb.js  # 项目数据库注入
│   │   └── csrf.js       # CSRF保护
│   ├── routes/           # API路由
│   │   ├── auth.js
│   │   ├── subjects.js
│   │   ├── selections.js
│   │   ├── admin.js
│   │   └── projects.js
│   ├── utils/            # 工具函数
│   │   ├── backup.js     # 备份管理
│   │   └── logger.js     # 日志工具
│   ├── databases/        # SQLite数据库文件
│   └── package.json
│
├── docs/                 # 文档目录
│   ├── API.md           # API文档
│   ├── DATABASE.md      # 数据库设计
│   └── *.md
│
├── scripts/             # 工具脚本
├── .env.example         # 环境变量模板
├── .gitignore
├── README.md            # 项目概述
├── ARCHITECTURE.md      # 架构设计
├── CONTRIBUTING.md      # 贡献指南
└── CHANGELOG.md         # 变更日志
```

---

## 🔧 开发工作流

### 日常开发

```bash
# 1. 启动开发服务器
cd server
npm run dev  # 使用 nodemon 自动重启

# 2. 在另一个终端查看日志
tail -f server/logs/*.log  # Linux/Mac
Get-Content server\logs\*.log -Wait  # Windows PowerShell
```

### 代码修改流程

1. **创建功能分支**
```bash
git checkout -b feature/your-feature-name
```

2. **进行开发**
- 修改代码
- 测试功能
- 编写测试用例

3. **提交代码**
```bash
git add .
git commit -m "feat: 添加新功能描述"
```

4. **推送并创建PR**
```bash
git push origin feature/your-feature-name
```

### Git 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```bash
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整（不影响功能）
refactor: 重构（不是新功能也不是修复bug）
test: 测试相关
chore: 构建/工具链相关
perf: 性能优化
```

**示例**：
```bash
git commit -m "feat: 添加学生批量导入功能"
git commit -m "fix: 修复选科容量计算错误"
git commit -m "docs: 更新API文档"
```

---

## 🧪 测试

### 运行测试

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 监听模式（开发时使用）
npm run test:watch

# 生成覆盖率报告
npm test -- --coverage
```

### 手动测试

1. **登录功能测试**
```bash
# 使用 curl 测试登录API
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@example.com","password":"Admin123456"}'
```

2. **数据库查看**
```bash
# 使用 sqlite3 命令行工具
sqlite3 server/databases/platform.db
> .tables
> SELECT * FROM Projects;
> .quit
```

---

## 🐛 调试技巧

### 后端调试

**使用 VS Code 调试器**：

创建 `.vscode/launch.json`：
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "启动服务器",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/server/app.js",
      "envFile": "${workspaceFolder}/server/.env"
    }
  ]
}
```

**使用 console.log**：
```javascript
// 在代码中添加调试输出
console.log('[DEBUG] 用户数据:', user);
console.log('[DEBUG] 选科信息:', selection);
```

### 前端调试

1. 打开浏览器开发者工具（F12）
2. 查看 Console 标签页的错误信息
3. 使用 Network 标签页查看 API 请求
4. 使用 Application 标签页查看 LocalStorage

---

## 📚 常用命令

### 数据库操作

```bash
# 查看所有项目
sqlite3 server/databases/platform.db "SELECT * FROM Projects;"

# 查看某个项目的学生
sqlite3 server/databases/project_xxx.db "SELECT * FROM Users;"

# 备份数据库
cp server/databases/*.db backup/
```

### 清理与重置

```bash
# 清理 node_modules
rm -rf node_modules package-lock.json
npm install

# 重置数据库（谨慎使用！）
rm server/databases/*.db
npm start  # 重新创建数据库
```

---

## 🔍 常见问题

### Q1: 端口 3000 被占用

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <进程ID> /F

# Linux/Mac
lsof -i :3000
kill -9 <进程ID>
```

### Q2: 数据库锁定错误

```bash
# 关闭所有访问数据库的程序
# 删除 .db-shm 和 .db-wal 文件
rm server/databases/*.db-shm
rm server/databases/*.db-wal
```

### Q3: JWT 验证失败

检查 `.env` 文件中的 `JWT_SECRET` 是否正确配置。

### Q4: CORS 错误

确保 `.env` 中的 `ALLOWED_ORIGINS` 包含你的前端地址。

---

## 📖 进阶阅读

- [架构设计文档](ARCHITECTURE.md) - 了解系统架构
- [API 文档](docs/API.md) - 查看所有 API 接口
- [数据库设计](docs/DATABASE.md) - 了解数据模型
- [贡献指南](CONTRIBUTING.md) - 如何贡献代码
- [安全配置](SECURITY.md) - 安全最佳实践

---

## 🤝 获取帮助

遇到问题？

1. 查看 [故障排查指南](TROUBLESHOOTING.md)
2. 搜索已有的 Issues
3. 创建新的 Issue 并提供详细信息
4. 联系项目维护者

---

## 🎉 开始开发

现在你已经准备好开始开发了！建议从以下任务开始：

1. 浏览代码库，熟悉项目结构
2. 运行测试，确保环境正常
3. 尝试修复一个简单的 bug
4. 查看 [ROADMAP.md](ROADMAP.md) 了解待开发功能

祝你开发愉快！🚀

---

**最后更新**: 2026-02-19
**维护者**: 开发团队
