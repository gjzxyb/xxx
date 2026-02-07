# 密码强度策略使用说明

本文档介绍如何在系统中使用密码强度验证功能。

## 功能概述

密码强度策略功能包括：
- 后端密码验证中间件
- 前端实时密码强度指示器
- 密码规则可视化提示
- 密码确认匹配检查

## 后端使用

### 1. 密码策略配置

密码策略在 `server/middleware/passwordPolicy.js` 中定义：

```javascript
const PASSWORD_POLICY = {
  minLength: 8,           // 最小长度
  maxLength: 32,          // 最大长度
  requireUppercase: true, // 需要大写字母
  requireLowercase: true, // 需要小写字母
  requireNumber: true,    // 需要数字
  requireSpecial: false,  // 需要特殊字符（可选）
  forbiddenPatterns: ['123456', 'password', 'qwerty'] // 禁止的密码
};
```

### 2. 在路由中应用验证

在需要密码验证的路由中使用中间件：

```javascript
const { validatePasswordMiddleware } = require('../middleware/passwordPolicy');

// 用户注册
router.post('/register', validatePasswordMiddleware, async (req, res) => {
  // 如果密码不符合要求，会在中间件中返回错误
  // 这里的代码只有在密码验证通过后才会执行
});

// 修改密码
router.put('/password', authenticate, validatePasswordMiddleware, async (req, res) => {
  // 密码验证逻辑
});
```

### 3. 已应用的接口

以下接口已经应用了密码验证：

- `POST /api/auth/register` - 用户注册
- `PUT /api/auth/password` - 修改密码
- `POST /api/admin/students` - 添加学生（管理员）

### 4. 获取密码策略

前端可以通过以下接口获取密码策略配置：

```
GET /api/auth/password-policy
```

## 前端使用

### 1. 引入组件

在HTML页面中引入密码强度指示器：

```html
<!-- 引入CSS（已在 style.css 中） -->
<link rel="stylesheet" href="css/style.css">

<!-- 引入JS -->
<script src="js/passwordStrength.js"></script>
```

### 2. HTML 结构

```html
<div class="form-group">
  <label class="form-label">密码</label>
  <input type="password" id="password" class="form-input" placeholder="请输入密码">
  <!-- 密码强度指示器容器 -->
  <div id="passwordStrengthContainer"></div>
</div>

<div class="form-group">
  <label class="form-label">确认密码</label>
  <input type="password" id="confirmPassword" class="form-input" placeholder="请再次输入密码">
</div>
```

### 3. 初始化组件

```javascript
// 初始化密码强度指示器
const passwordStrength = new PasswordStrengthIndicator({
  passwordInput: document.getElementById('password'),
  confirmInput: document.getElementById('confirmPassword'), // 可选
  container: document.getElementById('passwordStrengthContainer')
});

// 在表单提交前验证
form.addEventListener('submit', (e) => {
  if (!passwordStrength.isValid()) {
    e.preventDefault();
    const errors = passwordStrength.getErrors();
    alert(errors.join('\n'));
    return;
  }
  // 继续提交...
});
```

### 4. 完整示例

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>修改密码</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div class="container">
    <div class="card" style="max-width: 500px; margin: 2rem auto;">
      <h2>修改密码</h2>
      <form id="changePasswordForm">
        <div class="form-group">
          <label class="form-label">原密码</label>
          <input type="password" id="oldPassword" class="form-input" required>
        </div>

        <div class="form-group">
          <label class="form-label">新密码</label>
          <input type="password" id="newPassword" class="form-input" required>
          <div id="passwordStrengthContainer"></div>
        </div>

        <div class="form-group">
          <label class="form-label">确认新密码</label>
          <input type="password" id="confirmPassword" class="form-input" required>
        </div>

        <button type="submit" class="btn btn-primary">修改密码</button>
      </form>
    </div>
  </div>

  <script src="js/api.js"></script>
  <script src="js/passwordStrength.js"></script>
  <script>
    // 初始化密码强度指示器
    const passwordStrength = new PasswordStrengthIndicator({
      passwordInput: document.getElementById('newPassword'),
      confirmInput: document.getElementById('confirmPassword'),
      container: document.getElementById('passwordStrengthContainer')
    });

    // 表单提交
    document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      // 验证密码强度
      if (!passwordStrength.isValid()) {
        const errors = passwordStrength.getErrors();
        alert('密码不符合要求：\n' + errors.join('\n'));
        return;
      }

      const oldPassword = document.getElementById('oldPassword').value;
      const newPassword = document.getElementById('newPassword').value;

      const result = await api.auth.changePassword(oldPassword, newPassword);
      
      if (result.code === 200) {
        alert('密码修改成功！');
        window.location.href = '/';
      } else {
        alert(result.message || '密码修改失败');
      }
    });
  </script>
</body>
</html>
```

## API 方法

### PasswordStrengthIndicator 类

#### 构造函数

```javascript
new PasswordStrengthIndicator(options)
```

**参数：**
- `options.passwordInput` - 密码输入框元素（必需）
- `options.confirmInput` - 确认密码输入框元素（可选）
- `options.container` - 指示器容器元素（必需）

#### 方法

**isValid()**
- 返回：`boolean`
- 说明：检查密码是否有效

**getErrors()**
- 返回：`string[]`
- 说明：获取所有验证错误信息

**checkPassword(password)**
- 参数：`password` - 要验证的密码
- 返回：`{ isValid: boolean, errors: string[], strength: string }`
- 说明：手动验证密码

## 密码强度等级

- **弱（weak）**：红色，基本要求未满足
- **中等（medium）**：黄色，满足基本要求
- **强（strong）**：绿色，满足所有要求且复杂度高

## 验证规则

默认密码必须满足以下条件：

1. ✓ 长度在 8-32 个字符之间
2. ✓ 包含至少一个小写字母 (a-z)
3. ✓ 包含至少一个大写字母 (A-Z)
4. ✓ 包含至少一个数字 (0-9)
5. ✓ 不包含常见弱密码（如 123456、password 等）

## 错误处理

### 后端错误响应

当密码不符合要求时，后端返回：

```json
{
  "code": 400,
  "message": "密码不符合安全要求",
  "errors": [
    "密码至少需要8位",
    "密码需要包含至少一个大写字母"
  ]
}
```

### 前端错误显示

前端组件会实时显示密码规则的满足情况，用户可以直观地看到哪些规则未满足。

## 测试

### 测试密码示例

**弱密码（不通过）：**
- `123456` - 太简单
- `password` - 常见密码
- `abcdefgh` - 缺少大写字母和数字

**中等密码（通过）：**
- `Password1` - 满足基本要求
- `Abcd1234` - 满足基本要求

**强密码（推荐）：**
- `MyP@ssw0rd2024` - 长度足够，包含特殊字符
- `SecurePass123!` - 复杂度高
- `Tr0ng!Password` - 无常见模式

## 常见问题

**Q: 如何修改密码策略？**

A: 编辑 `server/middleware/passwordPolicy.js` 中的 `PASSWORD_POLICY` 对象。

**Q: 如何禁用某个验证规则？**

A: 将对应的规则设置为 `false`，例如 `requireSpecial: false`。

**Q: 密码强度指示器不显示？**

A: 检查：
1. 是否正确引入了 JS 和 CSS 文件
2. 容器元素是否存在
3. 输入框元素是否正确传入

**Q: 如何自定义样式？**

A: 在 `style.css` 中覆盖以下类的样式：
- `.password-strength-container`
- `.password-strength-bar`
- `.password-strength-indicator`
- `.password-rules`

## 更新日志

**v1.0.0 (2026-02-07)**
- ✅ 实现后端密码策略中间件
- ✅ 实现前端密码强度指示器
- ✅ 应用到注册和修改密码接口
- ✅ 支持密码确认匹配检查
