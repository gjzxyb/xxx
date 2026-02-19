# API 文档

## 概述

学生选科系统提供完整的 RESTful API，支持用户认证、选科管理、数据统计等功能。

## 基础信息

- **Base URL**: `http://localhost:3000/api`
- **认证方式**: Bearer Token (JWT)
- **数据格式**: JSON

## 快速开始

### 1. 安装依赖

```bash
npm install swagger-jsdoc swagger-ui-express --save
```

### 2. 在 app.js 中集成 Swagger

```javascript
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: '选科系统 API 文档'
}));
```

### 3. 访问文档

启动服务器后访问: `http://localhost:3000/api-docs`

## 统一响应格式

所有 API 响应均遵循以下格式：

### 成功响应

```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 错误响应

```json
{
  "code": 400,
  "message": "错误信息",
  "data": null,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 分页响应

```json
{
  "code": 200,
  "message": "查询成功",
  "data": [ ... ],
  "meta": {
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 10,
      "totalPages": 10,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 认证

### 登录

**请求**

```http
POST /api/auth/login
Content-Type: application/json

{
  "studentId": "2024001",
  "password": "123456",
  "projectId": "project-id-here"
}
```

**响应**

```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "studentId": "2024001",
      "name": "张三",
      "role": "student"
    }
  }
}
```

### 使用认证令牌

在后续请求中，需要在 Header 中携带 token：

```http
Authorization: Bearer <your-token>
```

## 主要接口

### 认证相关

| 方法 | 路径 | 描述 | 需要认证 |
|------|------|------|----------|
| POST | `/api/auth/login` | 用户登录 | ❌ |
| POST | `/api/auth/register` | 用户注册 | ❌ |
| GET | `/api/auth/profile` | 获取个人信息 | ✅ |
| PUT | `/api/auth/password` | 修改密码 | ✅ |
| POST | `/api/auth/logout` | 退出登录 | ✅ |

#### POST /api/auth/login - 用户登录

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| studentId | string | ✅ | 学号 |
| password | string | ✅ | 密码 |
| projectId | string | ✅ | 项目ID |

**请求示例**

```json
{
  "studentId": "2024001",
  "password": "Password123!",
  "projectId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**成功响应 (200)**

```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "studentId": "2024001",
      "name": "张三",
      "className": "高一(1)班",
      "role": "student",
      "projectId": "550e8400-e29b-41d4-a716-446655440000"
    }
  },
  "timestamp": "2026-02-19T12:00:00.000Z"
}
```

**错误响应**

- **401 Unauthorized** - 学号或密码错误
```json
{
  "code": 401,
  "message": "学号或密码错误，剩余尝试次数：4",
  "remainingAttempts": 4
}
```

- **423 Locked** - 账号被锁定
```json
{
  "code": 423,
  "message": "登录失败次数过多，账号已被锁定15分钟",
  "lockedUntil": "2026-02-19T12:15:00.000Z"
}
```

- **429 Too Many Requests** - 请求过于频繁
```json
{
  "code": 429,
  "message": "请求过于频繁，请稍后再试"
}
```

#### GET /api/auth/profile - 获取个人信息

**请求头**

```
Authorization: Bearer <token>
```

**成功响应 (200)**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "id": 1,
    "studentId": "2024001",
    "name": "张三",
    "className": "高一(1)班",
    "role": "student",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

#### PUT /api/auth/password - 修改密码

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| oldPassword | string | ✅ | 旧密码 |
| newPassword | string | ✅ | 新密码 (8-20位，包含大小写字母和数字) |

**请求示例**

```json
{
  "oldPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}
```

**成功响应 (200)**

```json
{
  "code": 200,
  "message": "密码修改成功"
}
```

**错误响应**

- **400 Bad Request** - 密码格式不符合要求
```json
{
  "code": 400,
  "message": "密码必须包含大小写字母和数字，长度8-20位"
}
```

- **401 Unauthorized** - 旧密码错误
```json
{
  "code": 401,
  "message": "旧密码错误"
}
```

#### POST /api/auth/logout - 退出登录

**请求头**

```
Authorization: Bearer <token>
```

**成功响应 (200)**

```json
{
  "code": 200,
  "message": "退出登录成功"
}
```

### 科目管理

| 方法 | 路径 | 描述 | 需要认证 |
|------|------|------|----------|
| GET | `/api/subjects` | 获取科目列表 | ✅ |
| GET | `/api/subjects/:id` | 获取科目详情 | ✅ |
| POST | `/api/subjects` | 创建科目 | ✅ (管理员) |
| PUT | `/api/subjects/:id` | 更新科目 | ✅ (管理员) |
| DELETE | `/api/subjects/:id` | 删除科目 | ✅ (管理员) |

#### GET /api/subjects - 获取科目列表

**请求头**

```
Authorization: Bearer <token>
```

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| category | string | ❌ | 科目类别 (首选/再选) |

**成功响应 (200)**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "id": 1,
      "name": "物理",
      "code": "PHY",
      "category": "首选",
      "description": "研究物质运动规律和物质基本结构的学科",
      "capacity": 100,
      "selectedCount": 45,
      "available": true,
      "createdAt": "2026-01-01T00:00:00.000Z"
    },
    {
      "id": 2,
      "name": "历史",
      "code": "HIS",
      "category": "首选",
      "description": "研究人类社会发展历程的学科",
      "capacity": 100,
      "selectedCount": 55,
      "available": true,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

#### POST /api/subjects - 创建科目 (管理员)

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | ✅ | 科目名称 |
| code | string | ✅ | 科目代码 |
| category | string | ✅ | 科目类别 (首选/再选) |
| description | string | ❌ | 科目描述 |
| capacity | number | ✅ | 容量限制 |

**请求示例**

```json
{
  "name": "化学",
  "code": "CHE",
  "category": "再选",
  "description": "研究物质的组成、结构、性质及变化规律",
  "capacity": 80
}
```

**成功响应 (201)**

```json
{
  "code": 201,
  "message": "创建成功",
  "data": {
    "id": 5,
    "name": "化学",
    "code": "CHE",
    "category": "再选",
    "description": "研究物质的组成、结构、性质及变化规律",
    "capacity": 80,
    "selectedCount": 0,
    "available": true
  }
}
```

### 选科管理

| 方法 | 路径 | 描述 | 需要认证 |
|------|------|------|----------|
| GET | `/api/selections/my` | 获取我的选科 | ✅ |
| POST | `/api/selections` | 提交选科 | ✅ |
| PUT | `/api/selections/:id` | 修改选科 | ✅ |
| GET | `/api/selections/stats` | 选科统计 | ✅ (管理员) |
| GET | `/api/selections/export` | 导出选科数据 | ✅ (管理员) |

#### GET /api/selections/my - 获取我的选科

**请求头**

```
Authorization: Bearer <token>
```

**成功响应 (200)**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "id": 1,
    "userId": 1,
    "firstChoiceId": 1,
    "firstChoice": {
      "id": 1,
      "name": "物理",
      "code": "PHY",
      "category": "首选"
    },
    "secondChoiceId": 3,
    "secondChoice": {
      "id": 3,
      "name": "化学",
      "code": "CHE",
      "category": "再选"
    },
    "thirdChoiceId": 5,
    "thirdChoice": {
      "id": 5,
      "name": "生物",
      "code": "BIO",
      "category": "再选"
    },
    "submittedAt": "2026-02-15T10:30:00.000Z",
    "status": "submitted"
  }
}
```

#### POST /api/selections - 提交选科

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| firstChoiceId | number | ✅ | 首选科目ID (物理/历史) |
| secondChoiceId | number | ✅ | 再选科目1 ID |
| thirdChoiceId | number | ✅ | 再选科目2 ID |

**请求示例**

```json
{
  "firstChoiceId": 1,
  "secondChoiceId": 3,
  "thirdChoiceId": 5
}
```

**成功响应 (201)**

```json
{
  "code": 201,
  "message": "选科提交成功",
  "data": {
    "id": 1,
    "userId": 1,
    "firstChoiceId": 1,
    "secondChoiceId": 3,
    "thirdChoiceId": 5,
    "submittedAt": "2026-02-19T12:00:00.000Z",
    "status": "submitted"
  }
}
```

**错误响应**

- **400 Bad Request** - 选科组合不符合规则
```json
{
  "code": 400,
  "message": "首选科目必须是物理或历史"
}
```

- **409 Conflict** - 科目容量已满
```json
{
  "code": 409,
  "message": "该科目容量已满，请选择其他科目"
}
```

- **403 Forbidden** - 不在选科时间内
```json
{
  "code": 403,
  "message": "当前不在选科时间范围内"
}
```

#### GET /api/selections/stats - 选科统计 (管理员)

**请求头**

```
Authorization: Bearer <token>
```

**成功响应 (200)**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "totalStudents": 200,
    "submittedCount": 180,
    "submissionRate": 90,
    "subjectStats": [
      {
        "id": 1,
        "name": "物理",
        "category": "首选",
        "capacity": 100,
        "selectedCount": 85,
        "utilizationRate": 85
      },
      {
        "id": 2,
        "name": "历史",
        "category": "首选",
        "capacity": 100,
        "selectedCount": 95,
        "utilizationRate": 95
      }
    ],
    "popularCombinations": [
      {
        "combination": "物理+化学+生物",
        "count": 45,
        "percentage": 25
      },
      {
        "combination": "历史+政治+地理",
        "count": 38,
        "percentage": 21.1
      }
    ]
  }
}
```

#### GET /api/selections/export - 导出选科数据 (管理员)

**请求头**

```
Authorization: Bearer <token>
```

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| format | string | ❌ | 导出格式 (excel/csv)，默认 excel |

**成功响应 (200)**

返回 Excel 或 CSV 文件流，包含以下字段：
- 学号
- 姓名
- 班级
- 首选科目
- 再选科目1
- 再选科目2
- 提交时间

### 管理员功能

| 方法 | 路径 | 描述 | 需要认证 |
|------|------|------|----------|
| GET | `/api/admin/users` | 获取用户列表 | ✅ (管理员) |
| POST | `/api/admin/users/import` | 批量导入用户 | ✅ (管理员) |
| PUT | `/api/admin/users/:id` | 更新用户信息 | ✅ (管理员) |
| DELETE | `/api/admin/users/:id` | 删除用户 | ✅ (管理员) |
| POST | `/api/admin/time-settings` | 设置选科时间 | ✅ (管理员) |

#### GET /api/admin/users - 获取用户列表

**请求头**

```
Authorization: Bearer <token>
```

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | ❌ | 页码，默认 1 |
| limit | number | ❌ | 每页数量，默认 20 |
| role | string | ❌ | 角色筛选 (student/admin) |
| className | string | ❌ | 班级筛选 |
| search | string | ❌ | 搜索关键词 (学号/姓名) |

**成功响应 (200)**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "id": 1,
      "studentId": "2024001",
      "name": "张三",
      "className": "高一(1)班",
      "role": "student",
      "hasSubmitted": true,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "total": 200,
      "page": 1,
      "limit": 20,
      "totalPages": 10,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

#### POST /api/admin/users/import - 批量导入用户

**请求头**

```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | file | ✅ | Excel 文件 (.xlsx) |

**Excel 文件格式要求**

| 列名 | 必填 | 说明 |
|------|------|------|
| 学号 | ✅ | 唯一标识 |
| 姓名 | ✅ | 学生姓名 |
| 班级 | ✅ | 所在班级 |
| 密码 | ❌ | 初始密码，默认为学号 |

**成功响应 (200)**

```json
{
  "code": 200,
  "message": "导入成功",
  "data": {
    "total": 100,
    "success": 98,
    "failed": 2,
    "errors": [
      {
        "row": 5,
        "studentId": "2024005",
        "error": "学号已存在"
      },
      {
        "row": 12,
        "studentId": "",
        "error": "学号不能为空"
      }
    ]
  }
}
```

#### PUT /api/admin/users/:id - 更新用户信息

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | ❌ | 姓名 |
| className | string | ❌ | 班级 |
| password | string | ❌ | 重置密码 |

**请求示例**

```json
{
  "name": "张三",
  "className": "高一(2)班"
}
```

**成功响应 (200)**

```json
{
  "code": 200,
  "message": "更新成功",
  "data": {
    "id": 1,
    "studentId": "2024001",
    "name": "张三",
    "className": "高一(2)班",
    "role": "student"
  }
}
```

#### POST /api/admin/time-settings - 设置选科时间

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| startTime | string | ✅ | 开始时间 (ISO 8601) |
| endTime | string | ✅ | 结束时间 (ISO 8601) |
| allowModification | boolean | ❌ | 是否允许修改，默认 true |

**请求示例**

```json
{
  "startTime": "2026-03-01T00:00:00.000Z",
  "endTime": "2026-03-31T23:59:59.000Z",
  "allowModification": true
}
```

**成功响应 (200)**

```json
{
  "code": 200,
  "message": "设置成功",
  "data": {
    "id": 1,
    "startTime": "2026-03-01T00:00:00.000Z",
    "endTime": "2026-03-31T23:59:59.000Z",
    "allowModification": true,
    "isActive": true
  }
}
```

## 状态码说明

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 204 | 删除成功（无内容） |
| 400 | 请求参数错误 |
| 401 | 未授权（未登录或token失效） |
| 403 | 禁止访问（权限不足） |
| 404 | 资源不存在 |
| 409 | 资源冲突 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

## 错误处理

所有错误响应都包含详细的错误信息：

```json
{
  "code": 400,
  "message": "输入验证失败",
  "errors": [
    {
      "field": "studentId",
      "message": "学号不能为空",
      "value": ""
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 速率限制

为防止滥用，API 实施了速率限制：

- **通用接口**: 100 请求/15分钟
- **认证接口**: 5 请求/15分钟

超出限制将返回 429 状态码。

## 多租户支持

系统支持多租户模式，通过 `projectId` 参数区分不同项目：

```http
GET /api/subjects?projectId=your-project-id
```

## 开发建议

1. **使用环境变量**: 将 API Base URL 配置为环境变量
2. **错误处理**: 统一处理 401 错误，自动跳转到登录页
3. **Token 刷新**: 实现 token 自动刷新机制
4. **请求拦截**: 使用拦截器自动添加认证头
5. **响应拦截**: 统一处理错误响应

## 示例代码

### JavaScript (Fetch)

```javascript
// 登录
const login = async (studentId, password) => {
  const response = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ studentId, password })
  });
  
  const data = await response.json();
  if (data.code === 200) {
    localStorage.setItem('token', data.data.token);
  }
  return data;
};

// 获取科目列表（带认证）
const getSubjects = async () => {
  const token = localStorage.getItem('token');
  const response = await fetch('http://localhost:3000/api/subjects', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return await response.json();
};
```

### cURL

```bash
# 登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"studentId":"2024001","password":"123456"}'

# 获取科目列表
curl http://localhost:3000/api/subjects \
  -H "Authorization: Bearer <your-token>"
```

## 更新日志

### v1.0.0 (2024-01-01)

- ✅ 初始版本发布
- ✅ 用户认证功能
- ✅ 选科管理功能
- ✅ 数据统计功能
- ✅ 多租户支持

## 支持

如有问题或建议，请联系：

- **Email**: support@example.com
- **GitHub**: https://github.com/your-repo/issues
