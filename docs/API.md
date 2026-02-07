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

### 科目管理

| 方法 | 路径 | 描述 | 需要认证 |
|------|------|------|----------|
| GET | `/api/subjects` | 获取科目列表 | ✅ |
| GET | `/api/subjects/:id` | 获取科目详情 | ✅ |
| POST | `/api/subjects` | 创建科目 | ✅ (管理员) |
| PUT | `/api/subjects/:id` | 更新科目 | ✅ (管理员) |
| DELETE | `/api/subjects/:id` | 删除科目 | ✅ (管理员) |

### 选科管理

| 方法 | 路径 | 描述 | 需要认证 |
|------|------|------|----------|
| GET | `/api/selections/my` | 获取我的选科 | ✅ |
| POST | `/api/selections` | 提交选科 | ✅ |
| PUT | `/api/selections/:id` | 修改选科 | ✅ |
| GET | `/api/selections/stats` | 选科统计 | ✅ (管理员) |
| GET | `/api/selections/export` | 导出选科数据 | ✅ (管理员) |

### 管理员功能

| 方法 | 路径 | 描述 | 需要认证 |
|------|------|------|----------|
| GET | `/api/admin/users` | 获取用户列表 | ✅ (管理员) |
| POST | `/api/admin/users/import` | 批量导入用户 | ✅ (管理员) |
| PUT | `/api/admin/users/:id` | 更新用户信息 | ✅ (管理员) |
| DELETE | `/api/admin/users/:id` | 删除用户 | ✅ (管理员) |
| POST | `/api/admin/time-settings` | 设置选科时间 | ✅ (管理员) |

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
