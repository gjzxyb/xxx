# 测试文档 🧪

本文档介绍项目的测试策略、测试工具和测试用例编写规范。

## 📋 目录

- [测试策略](#测试策略)
- [测试环境搭建](#测试环境搭建)
- [单元测试](#单元测试)
- [集成测试](#集成测试)
- [端到端测试](#端到端测试)
- [测试覆盖率](#测试覆盖率)
- [持续集成](#持续集成)

---

## 测试策略

### 测试金字塔

```
        /\
       /E2E\        端到端测试（少量）
      /------\
     /  集成  \      集成测试（适量）
    /----------\
   /   单元测试  \    单元测试（大量）
  /--------------\
```

### 测试原则

1. **快速反馈**：单元测试应该在秒级完成
2. **独立性**：测试之间不应相互依赖
3. **可重复**：相同输入应产生相同结果
4. **清晰性**：测试代码应易于理解
5. **覆盖率**：目标 80% 以上代码覆盖率

---

## 测试环境搭建

### 安装测试依赖

```bash
cd server
npm install --save-dev jest supertest
```

### 配置 Jest

在 `package.json` 中添加：

```json
{
  "scripts": {
    "test": "jest --coverage",
    "test:watch": "jest --watch",
    "test:unit": "jest --testPathPattern=__tests__/unit"
  },
  "jest": {
    "testEnvironment": "node",
    "coverageDirectory": "coverage",
    "collectCoverageFrom": [
      "**/*.js",
      "!node_modules/**",
      "!coverage/**",
      "!__tests__/**"
    ],
    "testMatch": [
      "**/__tests__/**/*.test.js"
    ]
  }
}
```

### 创建测试目录结构

```bash
mkdir -p server/__tests__/{unit,integration,e2e}
```

```
server/
├── __tests__/
│   ├── unit/           # 单元测试
│   │   ├── models/
│   │   ├── utils/
│   │   └── middleware/
│   ├── integration/    # 集成测试
│   │   └── routes/
│   └── e2e/           # 端到端测试
│       └── scenarios/
└── ...
```

---

## 单元测试

### 测试工具函数

**文件**: `server/__tests__/unit/utils/validation.test.js`

```javascript
const { isValidEmail, isValidStudentId } = require('../../../utils/validation');

describe('验证工具函数', () => {
  describe('isValidEmail', () => {
    it('应该验证有效的邮箱地址', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('应该拒绝无效的邮箱地址', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
    });

    it('应该处理空值', () => {
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(undefined)).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('isValidStudentId', () => {
    it('应该验证有效的学号', () => {
      expect(isValidStudentId('2024001')).toBe(true);
      expect(isValidStudentId('2024999')).toBe(true);
    });

    it('应该拒绝无效的学号', () => {
      expect(isValidStudentId('abc')).toBe(false);
      expect(isValidStudentId('123')).toBe(false);  // 太短
    });
  });
});
```

### 测试中间件

**文件**: `server/__tests__/unit/middleware/auth.test.js`

```javascript
const jwt = require('jsonwebtoken');
const { authenticateProject } = require('../../../middleware/auth');

describe('认证中间件', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      user: null,
      projectId: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  it('应该验证有效的 JWT Token', () => {
    const token = jwt.sign(
      { userId: 1, projectId: 'test-project', role: 'student' },
      process.env.JWT_SECRET || 'test-secret'
    );

    req.headers.authorization = `Bearer ${token}`;

    authenticateProject(req, res, next);

    expect(req.user).toBeDefined();
    expect(req.user.userId).toBe(1);
    expect(req.projectId).toBe('test-project');
    expect(next).toHaveBeenCalled();
  });

  it('应该拒绝缺少 Token 的请求', () => {
    authenticateProject(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      code: 401,
      message: expect.stringContaining('Token')
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('应该拒绝无效的 Token', () => {
    req.headers.authorization = 'Bearer invalid-token';

    authenticateProject(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('应该拒绝过期的 Token', () => {
    const expiredToken = jwt.sign(
      { userId: 1, projectId: 'test-project' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '-1h' }  // 已过期
    );

    req.headers.authorization = `Bearer ${expiredToken}`;

    authenticateProject(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
```

### 测试数据模型

**文件**: `server/__tests__/unit/models/User.test.js`

```javascript
const { Sequelize } = require('sequelize');
const UserModel = require('../../../models/project/User');

describe('User 模型', () => {
  let sequelize, User;

  beforeAll(async () => {
    // 使用内存数据库进行测试
    sequelize = new Sequelize('sqlite::memory:', {
      logging: false
    });

    User = UserModel(sequelize);
    await sequelize.sync();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  afterEach(async () => {
    await User.destroy({ where: {}, truncate: true });
  });

  it('应该创建新用户', async () => {
    const user = await User.create({
      studentId: '2024001',
      name: '张三',
      className: '高一1班',
      password: 'hashed-password',
      role: 'student'
    });

    expect(user.id).toBeDefined();
    expect(user.studentId).toBe('2024001');
    expect(user.name).toBe('张三');
  });

  it('应该拒绝重复的学号', async () => {
    await User.create({
      studentId: '2024001',
      name: '张三',
      className: '高一1班',
      password: 'hashed-password',
      role: 'student'
    });

    await expect(
      User.create({
        studentId: '2024001',  // 重复学号
        name: '李四',
        className: '高一2班',
        password: 'hashed-password',
        role: 'student'
      })
    ).rejects.toThrow();
  });

  it('应该验证必填字段', async () => {
    await expect(
      User.create({
        name: '张三',
        // 缺少 studentId
      })
    ).rejects.toThrow();
  });
});
```

---

## 集成测试

### 测试 API 路由

**文件**: `server/__tests__/integration/routes/auth.test.js`

```javascript
const request = require('supertest');
const app = require('../../../app');
const { sequelize } = require('../../../config/database');

describe('认证 API', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // 创建测试用户
      const bcrypt = require('bcryptjs');
      const User = require('../../../models/project/User')(sequelize);

      await User.create({
        studentId: 'test001',
        name: '测试用户',
        className: '测试班级',
        password: await bcrypt.hash('test123', 10),
        role: 'student'
      });
    });

    it('应该成功登录并返回 Token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'test001',
          password: 'test123',
          projectId: 'test-project'
        });

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(200);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.studentId).toBe('test001');
    });

    it('应该拒绝错误的密码', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'test001',
          password: 'wrong-password',
          projectId: 'test-project'
        });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe(401);
      expect(response.body.message).toContain('密码');
    });

    it('应该拒绝不存在的用户', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'test123',
          projectId: 'test-project'
        });

      expect(response.status).toBe(401);
    });

    it('应该验证必填字段', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'test001'
          // 缺少 password
        });

      expect(response.status).toBe(400);
    });
  });
});
```

### 测试选科流程

**文件**: `server/__tests__/integration/routes/selections.test.js`

```javascript
const request = require('supertest');
const app = require('../../../app');
const { getAuthToken } = require('../../helpers/auth');

describe('选科 API', () => {
  let authToken;
  let subjectIds;

  beforeAll(async () => {
    // 创建测试数据
    authToken = await getAuthToken('student');
    subjectIds = await createTestSubjects();
  });

  describe('POST /api/selections', () => {
    it('应该成功提交选科', async () => {
      const response = await request(app)
        .post('/api/selections')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstChoiceId: subjectIds.physics,
          secondChoiceId: subjectIds.chemistry,
          thirdChoiceId: subjectIds.biology
        });

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(200);
      expect(response.body.data.id).toBeDefined();
    });

    it('应该拒绝重复选科', async () => {
      // 第一次提交
      await request(app)
        .post('/api/selections')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstChoiceId: subjectIds.physics,
          secondChoiceId: subjectIds.chemistry,
          thirdChoiceId: subjectIds.biology
        });

      // 第二次提交（应该失败）
      const response = await request(app)
        .post('/api/selections')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstChoiceId: subjectIds.history,
          secondChoiceId: subjectIds.politics,
          thirdChoiceId: subjectIds.geography
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('已选科');
    });

    it('应该验证科目容量限制', async () => {
      // 设置科目容量为 0
      await setSubjectCapacity(subjectIds.physics, 0);

      const response = await request(app)
        .post('/api/selections')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstChoiceId: subjectIds.physics,
          secondChoiceId: subjectIds.chemistry,
          thirdChoiceId: subjectIds.biology
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('已满');
    });
  });

  describe('GET /api/selections/my', () => {
    it('应该获取当前用户的选科记录', async () => {
      // 先提交选科
      await request(app)
        .post('/api/selections')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstChoiceId: subjectIds.physics,
          secondChoiceId: subjectIds.chemistry,
          thirdChoiceId: subjectIds.biology
        });

      // 获取选科记录
      const response = await request(app)
        .get('/api/selections/my')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.firstChoice.id).toBe(subjectIds.physics);
    });
  });
});
```

---

## 端到端测试

### 使用 Playwright

**安装**：
```bash
npm install --save-dev @playwright/test
```

**配置**: `playwright.config.js`

```javascript
module.exports = {
  testDir: './server/__tests__/e2e',
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  }
};
```

**测试用例**: `server/__tests__/e2e/login.spec.js`

```javascript
const { test, expect } = require('@playwright/test');

test.describe('登录流程', () => {
  test('应该成功登录学生账号', async ({ page }) => {
    // 访问登录页
    await page.goto('/?projectId=test-project');

    // 填写表单
    await page.fill('input[name="username"]', 'test001');
    await page.fill('input[name="password"]', 'test123');

    // 点击登录按钮
    await page.click('button[type="submit"]');

    // 验证跳转到仪表板
    await expect(page).toHaveURL(/dashboard\.html/);

    // 验证显示用户名
    await expect(page.locator('.user-name')).toContainText('测试用户');
  });

  test('应该显示错误提示当密码错误', async ({ page }) => {
    await page.goto('/?projectId=test-project');

    await page.fill('input[name="username"]', 'test001');
    await page.fill('input[name="password"]', 'wrong-password');
    await page.click('button[type="submit"]');

    // 验证错误提示
    await expect(page.locator('.toast-error')).toBeVisible();
    await expect(page.locator('.toast-error')).toContainText('密码错误');
  });
});
```

---

## 测试覆盖率

### 运行覆盖率测试

```bash
npm test -- --coverage
```

### 查看覆盖率报告

```bash
# 生成 HTML 报告
npm test -- --coverage --coverageReporters=html

# 在浏览器中打开
open coverage/index.html
```

### 覆盖率目标

| 类型 | 目标 |
|------|------|
| 语句覆盖率 | ≥ 80% |
| 分支覆盖率 | ≥ 75% |
| 函数覆盖率 | ≥ 80% |
| 行覆盖率 | ≥ 80% |

### 排除文件

在 `package.json` 中配置：

```json
{
  "jest": {
    "coveragePathIgnorePatterns": [
      "/node_modules/",
      "/coverage/",
      "/__tests__/",
      "/config/"
    ]
  }
}
```

---

## 测试辅助工具

### 测试数据工厂

**文件**: `server/__tests__/helpers/factories.js`

```javascript
const bcrypt = require('bcryptjs');

// 创建测试用户
async function createTestUser(overrides = {}) {
  const defaults = {
    studentId: `test${Date.now()}`,
    name: '测试用户',
    className: '测试班级',
    password: await bcrypt.hash('test123', 10),
    role: 'student'
  };

  return { ...defaults, ...overrides };
}

// 创建测试科目
function createTestSubject(overrides = {}) {
  const defaults = {
    name: '测试科目',
    code: `TEST${Date.now()}`,
    category: 'reselect',
    capacity: 100,
    description: '测试科目描述'
  };

  return { ...defaults, ...overrides };
}

module.exports = {
  createTestUser,
  createTestSubject
};
```

### Mock 工具

```javascript
// Mock JWT 验证
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-token'),
  verify: jest.fn(() => ({ userId: 1, projectId: 'test' }))
}));

// Mock 数据库
jest.mock('../../../config/database', () => ({
  sequelize: {
    transaction: jest.fn(callback => callback()),
    sync: jest.fn()
  }
}));
```

---

## 持续集成

### GitHub Actions 配置

**文件**: `.github/workflows/test.yml`

```yaml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
    - uses: actions/checkout@v3

    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}

    - name: Install dependencies
      run: |
        cd server
        npm ci

    - name: Run tests
      run: |
        cd server
        npm test

    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        files: ./server/coverage/coverage-final.json
```

---

## 测试最佳实践

### 1. 测试命名

```javascript
// ✅ 好的命名
it('应该在密码错误时返回 401 状态码', () => {});

// ❌ 不好的命名
it('test login', () => {});
```

### 2. AAA 模式

```javascript
it('应该创建新用户', async () => {
  // Arrange（准备）
  const userData = {
    studentId: '2024001',
    name: '张三'
  };

  // Act（执行）
  const user = await User.create(userData);

  // Assert（断言）
  expect(user.id).toBeDefined();
  expect(user.studentId).toBe('2024001');
});
```

### 3. 测试隔离

```javascript
// 每个测试后清理数据
afterEach(async () => {
  await User.destroy({ where: {}, truncate: true });
});
```

### 4. 避免测试实现细节

```javascript
// ✅ 测试行为
expect(response.status).toBe(200);
expect(response.body.data.token).toBeDefined();

// ❌ 测试实现
expect(jwt.sign).toHaveBeenCalledWith(...);
```

---

## 运行测试

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 监听模式（开发时使用）
npm run test:watch

# 生成覆盖率报告
npm test -- --coverage

# 运行特定文件
npm test -- auth.test.js

# 运行匹配的测试
npm test -- --testNamePattern="登录"
```

---

## 调试测试

### VS Code 调试配置

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Jest 调试",
      "program": "${workspaceFolder}/server/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-cache"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### 使用 console.log

```javascript
it('调试测试', () => {
  const result = someFunction();
  console.log('结果:', result);  // 调试输出
  expect(result).toBe(expected);
});
```

---

**最后更新**: 2026-02-19
**维护者**: 测试团队
