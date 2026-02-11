/**
 * XSS 防护工具
 * 对用户输入进行消毒，防止 XSS 攻击
 */

/**
 * HTML 实体编码
 * @param {string} text - 需要编码的文本
 * @returns {string} 编码后的文本
 */
function escapeHtml(text) {
  if (typeof text !== 'string') {
    return text;
  }
  
  const htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };
  
  return text.replace(/[&<>"'/]/g, char => htmlEscapes[char]);
}

/**
 * 消毒字符串 - 移除危险字符和脚本
 * @param {string} str - 输入字符串
 * @returns {string} 消毒后的字符串
 */
function sanitizeString(str) {
  if (typeof str !== 'string') {
    return str;
  }
  
  return str
    // 移除 script 标签及其内容
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // 移除事件处理器
    .replace(/\s*on\w+\s*=\s*["']?[^"'>]*["']?/gi, '')
    // 移除 javascript: 伪协议
    .replace(/javascript:/gi, '')
    // 移除 data: URI
    .replace(/data:/gi, '')
    // 移除 expression (IE)
    .replace(/expression\s*\(/gi, '')
    // 移除 style 标签
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // 移除 iframe
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    // 移除 object/embed
    .replace(/<(object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '')
    // 移除 form 标签
    .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
    // 消毒 img 标签（移除 onerror 等）
    .replace(/<img[^>]*>/gi, match => {
      return match.replace(/\s*on\w+\s*=\s*["']?[^"'>]*["']?/gi, '');
    })
    // 消毒 a 标签
    .replace(/<a[^>]*>/gi, match => {
      return match.replace(/\s*on\w+\s*=\s*["']?[^"'>]*["']?/gi, '');
    })
    // 移除危险的 HTML 标签
    .replace(/<(script|style|iframe|object|embed|form|input|textarea|select)[^>]*>[\s\S]*?<\/\1>/gi, '');
}

/**
 * 深度消毒对象中的所有字符串
 * @param {Object} obj - 需要消毒的对象
 * @param {number} depth - 当前递归深度
 * @param {number} maxDepth - 最大递归深度
 * @returns {Object} 消毒后的对象
 */
function sanitizeObject(obj, depth = 0, maxDepth = 10) {
  if (depth > maxDepth) {
    return '[MAX_DEPTH_EXCEEDED]';
  }
  
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1, maxDepth));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // 消毒键名（防止原型污染）
      const sanitizedKey = typeof key === 'string' ? sanitizeString(key) : key;
      // 跳过危险键名
      if (['__proto__', 'constructor', 'prototype'].includes(sanitizedKey)) {
        continue;
      }
      sanitized[sanitizedKey] = sanitizeObject(value, depth + 1, maxDepth);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Express 中间件：消毒请求体
 */
function sanitizeMiddleware(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  
  // 消毒查询参数
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  
  // 消毒 URL 参数
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  
  next();
}

/**
 * 验证并消毒邮箱地址
 * @param {string} email - 邮箱地址
 * @returns {Object} { valid: boolean, sanitized: string, error: string }
 */
function validateAndSanitizeEmail(email) {
  if (typeof email !== 'string') {
    return { valid: false, sanitized: '', error: '邮箱必须是字符串' };
  }
  
  // 先消毒 HTML 标签
  let sanitized = sanitizeString(email);
  // 再进行 HTML 实体编码（移除所有 < > 等）
  sanitized = escapeHtml(sanitized).trim().toLowerCase();
  
  // RFC 5322 标准邮箱正则
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(sanitized)) {
    return { valid: false, sanitized, error: '邮箱格式不正确' };
  }
  
  // 检查长度
  if (sanitized.length > 254) {
    return { valid: false, sanitized, error: '邮箱长度超过限制' };
  }
  
  // 检查危险域名
  const dangerousDomains = ['localhost', '127.0.0.1', '0.0.0.0'];
  const domain = sanitized.split('@')[1];
  if (domain && dangerousDomains.some(d => domain.includes(d))) {
    return { valid: false, sanitized, error: '不允许使用本地域名邮箱' };
  }
  
  return { valid: true, sanitized, error: '' };
}

/**
 * 消毒文件名
 * @param {string} filename - 原始文件名
 * @returns {string} 消毒后的文件名
 */
function sanitizeFilename(filename) {
  if (typeof filename !== 'string') {
    return 'unnamed';
  }
  
  return filename
    // 移除路径分隔符
    .replace(/[\/\\]/g, '')
    // 移除 null 字节
    .replace(/\0/g, '')
    // 移除控制字符
    .replace(/[\x00-\x1f\x7f-\x9f]/g, '')
    // 移除危险的相对路径
    .replace(/\.\./g, '')
    // 限制长度
    .slice(0, 255);
}

module.exports = {
  escapeHtml,
  sanitizeString,
  sanitizeObject,
  sanitizeMiddleware,
  validateAndSanitizeEmail,
  sanitizeFilename
};
