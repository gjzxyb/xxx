/**
 * 数据脱敏工具
 * 防止敏感信息泄露
 */

/**
 * 敏感字段列表
 */
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'authorization',
  'apiKey',
  'api_key',
  'accessToken',
  'refreshToken',
  'csrfToken',
  'sessionId',
  'privateKey',
  'creditCard',
  'ssn',
  'idCard'
];

/**
 * 脱敏日志数据
 * @param {Object} data - 要脱敏的数据对象
 * @param {number} depth - 当前递归深度
 * @param {number} maxDepth - 最大递归深度
 * @returns {Object} 脱敏后的数据
 */
function sanitizeLog(data, depth = 0, maxDepth = 10) {
  // 防止无限递归
  if (depth > maxDepth) {
    return '[MAX_DEPTH_EXCEEDED]';
  }

  if (!data || typeof data !== 'object') {
    return data;
  }

  // 数组处理
  if (Array.isArray(data)) {
    return data.map(item => sanitizeLog(item, depth + 1, maxDepth));
  }

  // 对象处理
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    // 检查是否为敏感字段
    const isSensitive = SENSITIVE_FIELDS.some(field => 
      lowerKey.includes(field.toLowerCase())
    );
    
    if (isSensitive) {
      sanitized[key] = '***REDACTED***';
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeLog(value, depth + 1, maxDepth);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * 格式化日志参数（用于console.error重定向）
 * @param {Array} args - 日志参数数组
 * @returns {string} - 格式化后的消息
 */
function formatLogMessage(args) {
  return args.map(a => {
    if (typeof a === 'object' && a !== null) {
      try {
        const sanitized = sanitizeLog(a);
        return JSON.stringify(sanitized);
      } catch (e) {
        return String(a);
      }
    }
    return String(a);
  }).join(' ');
}

/**
 * 脱敏错误对象
 * @param {Error} error - 错误对象
 * @returns {Object} 脱敏后的错误信息
 */
function sanitizeError(error) {
  if (!error) return null;
  
  const sanitized = {
    message: error.message,
    name: error.name
  };
  
  // 仅在开发环境包含堆栈信息
  if (process.env.NODE_ENV === 'development') {
    sanitized.stack = error.stack;
  }
  
  return sanitized;
}

/**
 * 脱敏用户数据（用于Excel导出等）
 * @param {Object} user - 用户对象
 * @returns {Object} 脱敏后的用户数据
 */
function sanitizeUserData(user) {
  if (!user) return null;
  
  const { password, token, ...safeData } = user;
  return safeData;
}

/**
 * 脱敏学生列表（用于Excel导出）
 * @param {Array} students - 学生列表
 * @returns {Array} 脱敏后的学生列表
 */
function sanitizeStudentList(students) {
  if (!Array.isArray(students)) return [];
  
  return students.map(student => {
    const { password, ...safeStudent } = student.toJSON ? student.toJSON() : student;
    return safeStudent;
  });
}

/**
 * 部分脱敏（保留部分信息）
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return email;
  
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  
  const visibleChars = Math.min(3, Math.floor(name.length / 2));
  const masked = name.slice(0, visibleChars) + '***';
  return `${masked}@${domain}`;
}

function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return phone;
  
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 7) return '***';
  
  return cleaned.slice(0, 3) + '****' + cleaned.slice(-4);
}

function maskIdCard(idCard) {
  if (!idCard || typeof idCard !== 'string') return idCard;
  
  if (idCard.length < 8) return '***';
  return idCard.slice(0, 4) + '**********' + idCard.slice(-4);
}

module.exports = {
  sanitizeLog,
  sanitizeError,
  sanitizeUserData,
  sanitizeStudentList,
  maskEmail,
  maskPhone,
  maskIdCard,
  formatLogMessage,
  SENSITIVE_FIELDS
};
