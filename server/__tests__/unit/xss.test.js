/**
 * XSS 防护工具测试
 */

const {
  escapeHtml,
  sanitizeString,
  sanitizeObject,
  validateAndSanitizeEmail,
  sanitizeFilename
} = require('../../utils/xss');

describe('escapeHtml', () => {
  test('应该转义 HTML 特殊字符', () => {
    expect(escapeHtml('<script>alert("xss")</script>'))
      .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
    expect(escapeHtml("'single' & \"double\""))
      .toBe('&#x27;single&#x27; &amp; &quot;double&quot;');
    expect(escapeHtml('path/to/file'))
      .toBe('path&#x2F;to&#x2F;file');
  });

  test('应该处理非字符串输入', () => {
    expect(escapeHtml(null)).toBeNull();
    expect(escapeHtml(undefined)).toBeUndefined();
    expect(escapeHtml(123)).toBe(123);
    expect(escapeHtml({})).toEqual({});
  });
});

describe('sanitizeString', () => {
  test('应该移除 script 标签', () => {
    const input = '<script>alert("xss")</script>Hello';
    expect(sanitizeString(input)).toBe('Hello');
  });

  test('应该移除事件处理器', () => {
    const input = '<img src="x" onerror="alert(\'xss\')">';
    expect(sanitizeString(input)).not.toContain('onerror');
  });

  test('应该移除 javascript: 伪协议', () => {
    const input = '<a href="javascript:alert(\'xss\')">Click</a>';
    expect(sanitizeString(input)).not.toContain('javascript:');
  });

  test('应该处理非字符串输入', () => {
    expect(sanitizeString(null)).toBeNull();
    expect(sanitizeString(123)).toBe(123);
  });
});

describe('sanitizeObject', () => {
  test('应该消毒对象中的所有字符串', () => {
    const input = {
      name: '<script>alert("xss")</script>John',
      email: 'john@example.com',
      bio: '<p onload="evil()">Hello</p>'
    };
    const result = sanitizeObject(input);
    expect(result.name).not.toContain('<script>');
    expect(result.email).toBe('john@example.com');
    expect(result.bio).not.toContain('onload');
  });

  test('应该处理嵌套对象', () => {
    const input = {
      user: {
        name: '<script>alert("xss")</script>',
        profile: {
          description: '<img onerror="evil()">'
        }
      }
    };
    const result = sanitizeObject(input);
    expect(result.user.name).not.toContain('<script>');
    expect(result.user.profile.description).not.toContain('onerror');
  });

  test('应该处理数组', () => {
    const input = {
      items: [
        '<script>alert(1)</script>',
        '<script>alert(2)</script>'
      ]
    };
    const result = sanitizeObject(input);
    expect(result.items[0]).not.toContain('<script>');
    expect(result.items[1]).not.toContain('<script>');
  });

  test('应该防止原型污染', () => {
    const input = {
      '__proto__': { evil: true },
      'constructor': { prototype: { evil: true } },
      'normal': 'value'
    };
    const result = sanitizeObject(input);
    // 检查 __proto__ 不是 result 的自有属性
    expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(false);
    // constructor 不应该被污染
    expect(result.constructor).not.toEqual({ prototype: { evil: true } });
    expect(result.normal).toBe('value');
  });

  test('应该限制递归深度', () => {
    const input = { level: 1 };
    let current = input;
    for (let i = 2; i <= 15; i++) {
      current.nested = { level: i };
      current = current.nested;
    }
    const result = sanitizeObject(input);
    expect(result).toBeDefined();
  });
});

describe('validateAndSanitizeEmail', () => {
  test('应该验证有效邮箱', () => {
    const result = validateAndSanitizeEmail('user@example.com');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('user@example.com');
    expect(result.error).toBe('');
  });

  test('应该转义并消毒邮箱', () => {
    const result = validateAndSanitizeEmail('<script>user@example.com');
    expect(result.valid).toBe(false);
    expect(result.sanitized).not.toContain('<script>');
  });

  test('应该验证邮箱长度限制', () => {
    const longEmail = 'a'.repeat(250) + '@example.com';
    const result = validateAndSanitizeEmail(longEmail);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('长度');
  });

  test('应该拒绝本地域名', () => {
    const result = validateAndSanitizeEmail('user@localhost');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('本地域名');
  });

  test('应该处理非字符串输入', () => {
    const result = validateAndSanitizeEmail(null);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('字符串');
  });
});

describe('sanitizeFilename', () => {
  test('应该移除路径分隔符', () => {
    expect(sanitizeFilename('../../../etc/passwd')).toBe('etcpasswd');
    expect(sanitizeFilename('folder\\file.txt')).toBe('folderfile.txt');
  });

  test('应该移除 null 字节', () => {
    expect(sanitizeFilename('file\0.txt')).toBe('file.txt');
  });

  test('应该移除相对路径', () => {
    expect(sanitizeFilename('..file..txt')).toBe('filetxt');
  });

  test('应该限制文件名长度', () => {
    const longName = 'a'.repeat(300);
    expect(sanitizeFilename(longName).length).toBe(255);
  });

  test('应该处理非字符串输入', () => {
    expect(sanitizeFilename(null)).toBe('unnamed');
    expect(sanitizeFilename(123)).toBe('unnamed');
  });
});
