/**
 * 请求参数验证工具
 * 提供常用的参数验证和边界检查功能
 */

/**
 * 验证并清理分页参数
 * @param {number} page - 页码
 * @param {number} limit - 每页数量
 * @returns {Object} 清理后的分页参数
 */
function validatePagination(page, limit) {
  const parsedPage = parseInt(page) || 1;
  const parsedLimit = parseInt(limit) || 10;

  return {
    page: Math.max(1, parsedPage), // 最小为1
    limit: Math.min(Math.max(1, parsedLimit), 100) // 范围：1-100
  };
}

/**
 * 验证字符串长度
 * @param {string} value - 待验证的字符串
 * @param {number} minLength - 最小长度
 * @param {number} maxLength - 最大长度
 * @param {string} fieldName - 字段名称
 * @returns {Object} { valid: boolean, message: string }
 */
function validateStringLength(value, minLength, maxLength, fieldName = '字段') {
  if (typeof value !== 'string') {
    return { valid: false, message: `${fieldName}必须是字符串` };
  }

  const length = value.trim().length;

  if (length < minLength) {
    return { valid: false, message: `${fieldName}长度不能少于${minLength}个字符` };
  }

  if (length > maxLength) {
    return { valid: false, message: `${fieldName}长度不能超过${maxLength}个字符` };
  }

  return { valid: true, message: '' };
}

/**
 * 验证邮箱格式（RFC 5322 标准）
 * @param {string} email - 邮箱地址
 * @returns {boolean}
 */
function validateEmail(email) {
  if (typeof email !== 'string') {
    return false;
  }
  
  // RFC 5322 官方标准正则（简化版，覆盖 99.9% 的真实邮箱）
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(email)) {
    return false;
  }
  
  // 额外检查：总长度不超过 254 字符
  if (email.length > 254) {
    return false;
  }
  
  // 检查本地部分（@ 前）不超过 64 字符
  const localPart = email.split('@')[0];
  if (localPart && localPart.length > 64) {
    return false;
  }
  
  return true;
}

/**
 * 严格验证邮箱（包含域名检查）
 * @param {string} email - 邮箱地址
 * @param {Array<string>} allowedDomains - 允许的域名列表（可选）
 * @returns {Object} { valid: boolean, error: string }
 */
function validateEmailStrict(email, allowedDomains = []) {
  if (typeof email !== 'string') {
    return { valid: false, error: '邮箱必须是字符串' };
  }
  
  const trimmed = email.trim();
  
  if (!trimmed) {
    return { valid: false, error: '邮箱不能为空' };
  }
  
  if (!validateEmail(trimmed)) {
    return { valid: false, error: '邮箱格式不正确' };
  }
  
  // 如果指定了允许的域名列表，则检查
  if (allowedDomains.length > 0) {
    const domain = trimmed.split('@')[1]?.toLowerCase();
    if (!domain || !allowedDomains.some(d => domain === d.toLowerCase())) {
      return { valid: false, error: `只允许使用以下域名的邮箱: ${allowedDomains.join(', ')}` };
    }
  }
  
  // 检查常见拼写错误
  const commonTypos = {
    'gmial.com': 'gmail.com',
    'gmaill.com': 'gmail.com',
    'gnail.com': 'gmail.com',
    'hotmial.com': 'hotmail.com',
    'yahooo.com': 'yahoo.com',
    'yaho.com': 'yahoo.com'
  };
  
  const domain = trimmed.split('@')[1]?.toLowerCase();
  if (domain && commonTypos[domain]) {
    return { 
      valid: false, 
      error: `邮箱域名可能有误，您是否想输入: ${trimmed.split('@')[0]}@${commonTypos[domain]}?` 
    };
  }
  
  return { valid: true, error: '' };
}

/**
 * 验证学号格式（示例：支持数字、字母、下划线）
 * @param {string} studentId - 学号
 * @returns {boolean}
 */
function validateStudentId(studentId) {
  const studentIdRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return studentIdRegex.test(studentId);
}

/**
 * 验证必填字段
 * @param {Object} data - 数据对象
 * @param {Array<string>} requiredFields - 必填字段列表
 * @returns {Object} { valid: boolean, message: string, missingFields: Array }
 */
function validateRequiredFields(data, requiredFields) {
  const missingFields = [];

  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    return {
      valid: false,
      message: `缺少必填字段: ${missingFields.join(', ')}`,
      missingFields
    };
  }

  return { valid: true, message: '', missingFields: [] };
}

/**
 * 验证数值范围
 * @param {number} value - 待验证的值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @param {string} fieldName - 字段名称
 * @returns {Object} { valid: boolean, message: string }
 */
function validateNumberRange(value, min, max, fieldName = '数值') {
  const num = Number(value);

  if (isNaN(num)) {
    return { valid: false, message: `${fieldName}必须是数字` };
  }

  if (num < min || num > max) {
    return { valid: false, message: `${fieldName}必须在${min}到${max}之间` };
  }

  return { valid: true, message: '' };
}

/**
 * 清理和验证排序参数
 * @param {string} sortBy - 排序字段
 * @param {string} sortOrder - 排序方向
 * @param {Array<string>} allowedFields - 允许的排序字段列表
 * @returns {Object} { sortBy: string, sortOrder: string }
 */
function validateSortParams(sortBy, sortOrder, allowedFields = []) {
  const cleanSortBy = allowedFields.includes(sortBy) ? sortBy : allowedFields[0] || 'id';
  const cleanSortOrder = ['ASC', 'DESC'].includes(sortOrder?.toUpperCase()) 
    ? sortOrder.toUpperCase() 
    : 'ASC';

  return { sortBy: cleanSortBy, sortOrder: cleanSortOrder };
}

module.exports = {
  validatePagination,
  validateStringLength,
  validateEmail,
  validateEmailStrict,
  validateStudentId,
  validateRequiredFields,
  validateNumberRange,
  validateSortParams
};
