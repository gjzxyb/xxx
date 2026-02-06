# 学生分科自选系统 📚

一个基于 Node.js + SQLite 的多租户学生选科管理系统，支持物理数据隔离、实时统计分析和灵活的选科规则配置。

## 系统概述

本系统为高中学生提供在线选科功能，支持"3+1+2"新高考模式，实现了：
- 🏢 **多项目隔离**：每个学校/项目独立数据库，完全物理隔离
- 👥 **角色管理**：管理员和学生两种角色，权限分离
- 📊 **实时统计**：选科组合分析、剩余容量监控
- ⏰ **时间控制**：灵活的选科时间窗口配置
- 🔐 **安全可靠**：JWT认证、密码加密、数据验证

## 技术架构

### 后端技术栈
- **运行环境**: Node.js 18+
- **Web框架**: Express.js
- **数据库**: SQLite (多数据库架构)
- **ORM**: Sequelize
- **认证**: JWT + bcrypt
- **跨域**: CORS

### 前端技术栈
- **核心**: 原生 HTML5 + JavaScript (ES6+)
- **样式**: CSS3 + CSS Variables
- **字体**: Google Fonts (Inter)
- **工具库**: XLSX.js (数据导出)

### 项目结构

```
D:\xxx\
├── client/                 # 前端文件
│   ├── css/
│   │   └── style.css      # 全局样式
│   ├── js/
│   │   └── api.js         # API工具函数
│   ├── platform/          # 平台管理页面
│   │   ├── dashboard.html # 项目列表
│   │   └── css/
│   ├── index.html         # 登录页面
│   ├── dashboard.html     # 学生仪表板
│   ├── selection.html     # 选科页面
│   └── admin.html         # 管理后台
│
├── server/                # 后端服务
│   ├── app.js            # 应用入口
│   ├── config/           # 配置文件
│   ├── lib/
│   │   └── DatabaseManager.js  # 多数据库管理器
│   ├── models/           # 数据模型
│   │   ├── platform/     # 平台级模型（Project, PlatformUser）
│   │   └── project/      # 项目级模型（User, Subject, Selection）
│   ├── middleware/       # 中间件
│   │   ├── auth.js       # JWT认证
│   │   └── projectDb.js  # 项目数据库注入
│   ├── routes/           # API路由
│   │   ├── auth.js       # 认证API
│   │   ├── subjects.js   # 科目管理
│   │   ├── selections.js # 选科操作
│   │   ├── admin.js      # 管理员API
│   │   └── platform.js   # 平台管理
│   ├── utils/            # 工具函数
│   ├── databases/        # 项目数据库文件
│   │   ├── platform.db   # 平台数据库
│   │   └── project_{uuid}.db  # 各项目数据库
│   └── package.json
│
├── platform/             # 平台静态资源
└── .gitignore
```

## 核心功能

### 1. 平台管理
- **项目创建**: 动态创建独立数据库
- **凭据管理**: 设置管理员账号密码
- **项目列表**: 查看所有项目状态

### 2. 学生功能
- **在线选科**: 首选科目（物理/历史）+ 两门再选科目
- **实时反馈**: 显示剩余容量、选科状态
- **修改重选**: 在开放时间内可修改选科
- **个人中心**: 查看选科记录、个人信息

### 3. 管理员功能
- **科目管理**: CRUD操作、容量设置、分类管理
- **学生管理**: 批量导入、编辑、删除、密码重置
- **时间控制**: 设置选科开放/关闭时间
- **数据统计**: 选科组合统计、导出Excel
- **实时监控**: 已选/未选人数、完成率

## 数据库设计

### 平台数据库 (platform.db)

#### Project - 项目表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | STRING | 项目名称 |
| description | TEXT | 项目描述 |
| isActive | BOOLEAN | 是否激活 |
| databasePath | STRING | 数据库路径 |
| createdAt | DATE | 创建时间 |

#### PlatformUser - 平台用户表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| username | STRING | 用户名 |
| email | STRING | 邮箱 |
| password | STRING | 密码哈希 |
| role | ENUM | 角色（platform_admin） |

### 项目数据库 (project_{uuid}.db)

#### User - 用户表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| studentId | STRING | 学号（唯一） |
| name | STRING | 姓名 |
| className | STRING | 班级 |
| password | STRING | 密码哈希 |
| role | ENUM | 角色（admin/student） |

#### Subject - 科目表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| name | STRING | 科目名称 |
| code | STRING | 科目代码 |
| category | ENUM | 分类（physics_history/reselect） |
| capacity | INTEGER | 容量限制 |
| description | TEXT | 描述 |
| icon | STRING | 图标 |

#### Selection - 选科记录表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| userId | INTEGER | 用户ID（外键） |
| firstChoiceId | INTEGER | 首选科目ID |
| secondChoiceId | INTEGER | 再选科目1 ID |
| thirdChoiceId | INTEGER | 再选科目2 ID |
| submittedAt | DATE | 提交时间 |

#### SelectionConfig - 选科配置表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| key | STRING | 配置键 |
| value | STRING | 配置值 |

## 安装部署

### 环境要求
- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装步骤

1. **克隆项目**
```bash
cd D:\xxx
```

2. **安装依赖**
```bash
cd server
npm install
```

3. **启动服务**
```bash
npm start
```

4. **访问系统**
- 平台管理: http://localhost:3000/platform/dashboard.html
- 项目登录: http://localhost:3000/?projectId={项目ID}

### 依赖包说明
```json
{
  "express": "^4.18.2",        // Web框架
  "sequelize": "^6.35.0",      // ORM
  "sqlite3": "^5.1.6",         // SQLite驱动
  "bcrypt": "^5.1.1",          // 密码加密
  "jsonwebtoken": "^9.0.2",    // JWT认证
  "cors": "^2.8.5",            // 跨域处理
  "uuid": "^9.0.1"             // UUID生成
}
```

## 使用指南

### 1. 平台管理员操作流程

#### 创建新项目
1. 访问平台管理页面
2. 点击"创建项目"
3. 填写项目名称和描述
4. 系统自动创建独立数据库

#### 设置项目凭据
1. 在项目列表中找到目标项目
2. 点击"设置凭据"
3. 输入管理员用户名和密码
4. 保存后可以使用该凭据登录

### 2. 项目管理员操作流程

#### 初始配置
1. 使用管理员凭据登录: `http://localhost:3000/?projectId={项目ID}`
2. 进入管理后台

#### 科目管理
1. 点击"科目管理"标签
2. 添加科目：
   - 首选科目：物理、历史（category: physics_history）
   - 再选科目：化学、生物、政治、地理（category: reselect）
3. 设置每个科目的容量限制

#### 学生导入
1. 点击"学生列表" > "导入学生"
2. 下载Excel模板
3. 填写学生信息（学号、姓名、班级）
4. 上传Excel文件批量导入

#### 时间控制
1. 点击"时间设置"
2. 设置选科开始时间和结束时间
3. 开启/关闭选科功能

#### 数据统计
1. 查看"选科列表"：所有学生选科情况
2. 查看"组合统计"：各选科组合的人数分布
3. 导出Excel：下载完整数据

### 3. 学生操作流程

#### 登录系统
1. 访问项目登录页
2. 输入学号和密码（初始密码=学号）
3. 首次登录建议修改密码

#### 进行选科
1. 点击"选科"菜单
2. 选择首选科目（物理或历史）
3. 选择两门再选科目
4. 确认提交

#### 修改选科
1. 在选科开放期间可以修改
2. 重新选择科目
3. 再次提交覆盖原选择

## API 接口文档

### 认证接口

#### POST /api/auth/login
登录获取Token
```javascript
// 请求
{
  "username": "学号或用户名",
  "password": "密码",
  "projectId": "项目UUID"  // 可选
}

// 响应
{
  "code": 200,
  "data": {
    "token": "jwt_token",
    "user": { "id": 1, "name": "张三", "role": "student" }
  }
}
```

### 学生接口

#### GET /api/selections/status
获取选科状态
```javascript
// 响应
{
  "code": 200,
  "data": {
    "isOpen": true,
    "startTime": "2024-01-01 00:00:00",
    "endTime": "2024-12-31 23:59:59"
  }
}
```

#### POST /api/selections
提交选科
```javascript
// 请求
{
  "firstChoiceId": 1,    // 首选科目ID
  "secondChoiceId": 3,   // 再选科目1
  "thirdChoiceId": 4     // 再选科目2
}
```

#### DELETE /api/selections/my
取消选科

### 管理员接口

#### GET /api/admin/students
获取学生列表
```javascript
// 请求参数
?page=1&limit=20&className=高一1班

// 响应
{
  "code": 200,
  "data": {
    "total": 100,
    "data": [...]
  }
}
```

#### POST /api/admin/students/import
批量导入学生（Excel）

#### PUT /api/admin/students/:id
更新学生信息

#### DELETE /api/admin/students/:id
删除学生

#### POST /api/admin/students/:id/reset-password
重置密码为学号

## 多租户架构说明

### 数据隔离策略
- **物理隔离**: 每个项目独立SQLite文件
- **路径规范**: `databases/project_{uuid}.db`
- **动态加载**: 运行时根据projectId加载对应数据库
- **安全保障**: 中间件层面验证projectId，防止跨项目访问

### 中间件工作流程
```
请求 → authenticateProject (验证JWT + 提取projectId)
     → projectDb (加载项目数据库模型到req.projectModels)
     → 路由处理器 (使用req.projectModels操作数据)
```

### 示例：创建学生
```javascript
router.post('/students',
  authenticateProject,    // 验证JWT，提取projectId
  requireProjectAdmin,    // 验证管理员权限
  projectDb,             // 注入项目数据库模型
  async (req, res) => {
    const { User } = req.projectModels;  // 使用项目特定的模型
    const student = await User.create(req.body);
    res.json({ code: 200, data: student });
  }
);
```

## 常见问题

### Q1: 如何重置管理员密码？
A: 使用平台管理页面的"设置凭据"功能重新设置。

### Q2: 学生忘记密码怎么办？
A: 管理员可以在"学生列表"中点击"重置密码"按钮，密码将重置为学号。

### Q3: 如何修改选科容量限制？
A: 在"科目管理"中编辑对应科目，修改"容量"字段。

### Q4: 导出的Excel在哪里？
A: 浏览器会自动下载到默认下载目录。

### Q5: 如何备份数据？
A: 复制 `server/databases/` 目录下的所有 `.db` 文件即可。

## 系统特性

### ✅ 已实现功能
- [x] 多项目物理隔离
- [x] JWT身份认证
- [x] 学生批量导入
- [x] 选科容量控制
- [x] 实时统计分析
- [x] Excel数据导出
- [x] 时间窗口控制
- [x] Toast消息提示
- [x] 自定义确认对话框
- [x] 响应式布局

### 🚀 后续优化方向
- [ ] 密码强度策略
- [ ] 操作日志记录
- [ ] 数据自动备份
- [ ] 邮件通知功能
- [ ] 移动端适配优化
- [ ] 批量操作优化
- [ ] 数据可视化增强

## 维护说明

### 日常维护
- **数据库备份**: 定期备份 `databases/` 目录
- **日志查看**: 检查控制台输出
- **容量监控**: 关注各科目选科人数
- **性能优化**: 定期清理无用数据

### 故障排查
1. **无法登录**: 检查JWT_SECRET环境变量
2. **404错误**: 确认projectId参数正确
3. **数据库错误**: 检查文件权限和磁盘空间
4. **导入失败**: 验证Excel格式是否正确

## 开发规范

### 代码风格
- 使用ES6+语法
- 异步操作使用async/await
- 错误处理使用try-catch
- API响应统一格式：`{code, data, message}`

### Git提交规范
```bash
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 重构
test: 测试相关
chore: 构建/工具链相关
```

## 许可证

MIT License

## 联系方式

如有问题或建议，请联系系统管理员。

---

**最后更新**: 2026-02-06
**版本**: 1.0.0
**作者**: 学生选科系统开发组
