/**
 * 数据脱敏工具测试
 */

const {
  sanitizeLog,
  formatLogMessage,
  sanitizeError,
  maskEmail,
  maskPhone,
  SENSITIVE_FIELDS
} = require('../../utils/sanitize');

describe('sanitizeLog', () => {
  test('应该脱敏敏感字段', () => {
    const data = {
      username: 'testuser',
      password: 'secret123',
      token: 'jwt-token-here',
      email: 'test@example.com'
    };

    const result = sanitizeLog(data);

    expect(result.username).toBe('testuser');
    expect(result.password).toBe('***REDACTED***');
    expect(result.token).toBe('***REDACTED***');
    expect(result.email).toBe('test@example.com');
  });

  test('应该处理嵌套对象', () => {
    const data = {
      user: {
        name: 'John',
        credentials: {
          password: 'secret',
          apiKey: 'key123'
        }
      }
    };

    const result = sanitizeLog(data);

    expect(result.user.name).toBe('John');
    expect(result.user.credentials.password).toBe('***REDACTED***');
    expect(result.user.credentials.apiKey).toBe('***REDACTED***');
  });

  test('应该处理数组', () => {
    const data = {
      users: [
        { name: 'User1', password: 'pass1' },
        { name: 'User2', token: 'token2' }
      ]
    };

    const result = sanitizeLog(data);

    expect(result.users[0].name).toBe('User1');
    expect(result.users[0].password).toBe('***REDACTED***');
    expect(result.users[1].token).toBe('***REDACTED***');
  });

  test('应该防止无限递归', () => {
    const data = { level: 1 };
    let current = data;
    
    // 创建深度超过10的嵌套对象
    for (let i = 2; i <= 15; i++) {
      current.nested = { level: i };
      current = current.nested;
    }

    const result = sanitizeLog(data);
    
    // 应该在深度10处停止（允许1层误差）
    let depth = 0;
    let check = result;
    while (check.nested && depth < 20) {
      check = check.nested;
      depth++;
    }
    
    expect(depth).toBeLessThanOrEqual(11);
  });

  test('应该处理null和undefined', () => {
    expect(sanitizeLog(null)).toBeNull();
    expect(sanitizeLog(undefined)).toBeUndefined();
    expect(sanitizeLog({ value: null }).value).toBeNull();
  });
});

describe('formatLogMessage', () => {
  test('应该格式化混合类型参数', () => {
    const args = [
      'Error occurred:',
      { password: 'secret', message: 'Failed' },
      'Code: 500'
    ];

    const result = formatLogMessage(args);

    expect(result).toContain('Error occurred:');
    expect(result).toContain('***REDACTED***');
    expect(result).toContain('Failed');
    expect(result).toContain('Code: 500');
    expect(result).not.toContain('secret');
  });

  test('应该处理纯字符串参数', () => {
    const args = ['Simple', 'log', 'message'];
    const result = formatLogMessage(args);
    expect(result).toBe('Simple log message');
  });
});

describe('sanitizeError', () => {
  test('应该脱敏错误对象', () => {
    const error = new Error('Test error');
    error.password = 'secret';

    const result = sanitizeError(error);

    expect(result.message).toBe('Test error');
    expect(result.name).toBe('Error');
    expect(result.password).toBeUndefined();
  });

  test('开发环境应包含堆栈信息', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const error = new Error('Test error');
    const result = sanitizeError(error);

    expect(result.stack).toBeDefined();

    process.env.NODE_ENV = originalEnv;
  });

  test('生产环境不应包含堆栈信息', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const error = new Error('Test error');
    const result = sanitizeError(error);

    expect(result.stack).toBeUndefined();

    process.env.NODE_ENV = originalEnv;
  });
});

describe('maskEmail', () => {
  test('应该部分脱敏邮箱', () => {
    expect(maskEmail('john.doe@example.com')).toMatch(/joh\*\*\*@example\.com/);
    // 对于非常短的用户名，全部脱敏
    expect(maskEmail('a@test.com')).toMatch(/\*\*\*@test\.com/);
  });

  test('应该处理无效邮箱', () => {
    expect(maskEmail('invalid')).toBe('invalid');
    expect(maskEmail('')).toBe('');
    expect(maskEmail(null)).toBeNull();
  });
});

describe('maskPhone', () => {
  test('应该部分脱敏手机号', () => {
    expect(maskPhone('13812345678')).toBe('138****5678');
    expect(maskPhone('1234567')).toBe('123****4567');
  });

  test('应该处理无效手机号', () => {
    expect(maskPhone('123')).toBe('***');
    // 空字符串返回空字符串
    expect(maskPhone('')).toBe('');
  });
});

describe('SENSITIVE_FIELDS', () => {
  test('应该包含常见敏感字段', () => {
    expect(SENSITIVE_FIELDS).toContain('password');
    expect(SENSITIVE_FIELDS).toContain('token');
    expect(SENSITIVE_FIELDS).toContain('secret');
    expect(SENSITIVE_FIELDS).toContain('apiKey');
  });
});
