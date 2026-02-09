/**
 * 统一API响应格式工具函数
 * 提供标准化的JSON响应格式，便于前端对接
 */

/**
 * 统一响应格式工具
 * 安全性增强：防止错误信息泄露
 */
const { sanitizeError, sanitizeLog } = require('./sanitize');

/**
 * 成功响应
 * @param {Response} res - Express响应对象
 * @param {*} data - 响应数据
 * @param {string} message - 成功消息
 * @param {number} code - 状态码（默认200）
 */
function success(res, data = null, message = '操作成功', code = 200) {
  return res.status(code).json({
    code,
    message,
    data
  });
}

/**
 * 错误响应
 * @param {Response} res - Express响应对象
 * @param {string} message - 错误消息
 * @param {number} code - 错误码（默认400）
 * @param {*} details - 详细信息（仅开发环境返回）
 */
function error(res, message = '操作失败', code = 400, details = null) {
  const response = {
    code,
    message
  };

  // 安全性：生产环境不返回详细错误信息
  if (process.env.NODE_ENV !== 'production' && details) {
    // 即使在开发环境，也要脱敏
    response.details = sanitizeLog(details);
  }

  // 记录错误日志（脱敏后）
  if (code >= 500) {
    console.error(`[ERROR ${code}] ${message}`, sanitizeLog(details));
  } else if (process.env.NODE_ENV === 'development') {
    console.warn(`[WARN ${code}] ${message}`, sanitizeLog(details));
  }

  return res.status(code).json(response);
}

/**
 * 未授权响应（401）
 */
function unauthorized(res, message = '未授权访问') {
  return res.status(401).json({
    code: 401,
    message
  });
}

/**
 * 禁止访问响应（403）
 */
function forbidden(res, message = '禁止访问') {
  return res.status(403).json({
    code: 403,
    message
  });
}

/**
 * 未找到响应（404）
 */
function notFound(res, message = '资源不存在') {
  return res.status(404).json({
    code: 404,
    message
  });
}

/**
 * 服务器错误响应（500）
 * @param {Response} res - Express响应对象
 * @param {Error} err - 错误对象
 * @param {string} message - 用户友好的错误消息
 */
function serverError(res, err, message = '服务器内部错误') {
  // 记录完整错误（脱敏后）
  console.error('[SERVER ERROR]', sanitizeError(err));

  const response = {
    code: 500,
    message
  };

  // 开发环境返回错误堆栈（脱敏后）
  if (process.env.NODE_ENV === 'development') {
    response.error = sanitizeError(err);
  }

  return res.status(500).json(response);
}

/**
 * 验证错误响应（422）
 * @param {Response} res - Express响应对象
 * @param {Array} errors - 验证错误列表
 */
function validationError(res, errors = []) {
  return res.status(422).json({
    code: 422,
    message: '数据验证失败',
    errors: Array.isArray(errors) ? errors : [errors]
  });
}

/**
 * 速率限制响应（429）
 */
function tooManyRequests(res, message = '请求过于频繁，请稍后再试') {
  return res.status(429).json({
    code: 429,
    message
  });
}

module.exports = {
  success,
  error,
  unauthorized,
  forbidden,
  notFound,
  serverError,
  validationError,
  tooManyRequests
};
