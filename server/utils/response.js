/**
 * 统一API响应格式工具函数
 * 提供标准化的JSON响应格式，便于前端对接
 */

/**
 * 成功响应
 * @param {Object} res - Express response 对象
 * @param {*} data - 响应数据
 * @param {string} message - 成功消息
 * @param {Object} meta - 元数据（如分页信息）
 */
const success = (res, data = null, message = '操作成功', meta = null) => {
  const response = {
    code: 200,
    message,
    data,
    timestamp: new Date().toISOString()
  };
  
  if (meta) {
    response.meta = meta;
  }
  
  res.json(response);
};

/**
 * 分页成功响应
 * @param {Object} res - Express response 对象
 * @param {Array} items - 数据列表
 * @param {number} total - 总记录数
 * @param {number} page - 当前页码
 * @param {number} limit - 每页条数
 * @param {string} message - 成功消息
 */
const successWithPagination = (res, items, total, page, limit, message = '查询成功') => {
  const totalPages = Math.ceil(total / limit);
  
  success(res, items, message, {
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  });
};

/**
 * 错误响应
 * @param {Object} res - Express response 对象
 * @param {string} message - 错误消息
 * @param {number} code - HTTP状态码
 * @param {*} details - 错误详情
 */
const error = (res, message = '操作失败', code = 400, details = null) => {
  const response = {
    code,
    message,
    data: null,
    timestamp: new Date().toISOString()
  };
  
  if (details) {
    response.details = details;
  }
  
  res.status(code).json(response);
};

/**
 * 验证错误响应
 * @param {Object} res - Express response 对象
 * @param {Array} errors - 验证错误列表
 * @param {string} message - 错误消息
 */
const validationError = (res, errors, message = '输入验证失败') => {
  res.status(400).json({
    code: 400,
    message,
    data: null,
    errors,
    timestamp: new Date().toISOString()
  });
};

/**
 * 未授权响应 (401)
 * @param {Object} res - Express response 对象
 * @param {string} message - 错误消息
 */
const unauthorized = (res, message = '未授权访问，请先登录') => {
  res.status(401).json({
    code: 401,
    message,
    data: null,
    timestamp: new Date().toISOString()
  });
};

/**
 * 禁止访问响应 (403)
 * @param {Object} res - Express response 对象
 * @param {string} message - 错误消息
 */
const forbidden = (res, message = '权限不足，禁止访问') => {
  res.status(403).json({
    code: 403,
    message,
    data: null,
    timestamp: new Date().toISOString()
  });
};

/**
 * 资源不存在响应 (404)
 * @param {Object} res - Express response 对象
 * @param {string} message - 错误消息
 */
const notFound = (res, message = '请求的资源不存在') => {
  res.status(404).json({
    code: 404,
    message,
    data: null,
    timestamp: new Date().toISOString()
  });
};

/**
 * 服务器错误响应 (500)
 * @param {Object} res - Express response 对象
 * @param {string} message - 错误消息
 * @param {Error} err - 错误对象（仅开发环境返回）
 */
const serverError = (res, message = '服务器内部错误', err = null) => {
  const response = {
    code: 500,
    message,
    data: null,
    timestamp: new Date().toISOString()
  };
  
  // 仅在开发环境返回错误堆栈
  if (process.env.NODE_ENV === 'development' && err) {
    response.stack = err.stack;
    response.error = err.message;
  }
  
  res.status(500).json(response);
};

/**
 * 创建响应（201）
 * @param {Object} res - Express response 对象
 * @param {*} data - 创建的资源数据
 * @param {string} message - 成功消息
 */
const created = (res, data = null, message = '创建成功') => {
  res.status(201).json({
    code: 201,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};

/**
 * 无内容响应（204）
 * @param {Object} res - Express response 对象
 */
const noContent = (res) => {
  res.status(204).send();
};

/**
 * 冲突响应（409）
 * @param {Object} res - Express response 对象
 * @param {string} message - 错误消息
 */
const conflict = (res, message = '资源冲突') => {
  res.status(409).json({
    code: 409,
    message,
    data: null,
    timestamp: new Date().toISOString()
  });
};

/**
 * 请求过多响应（429）
 * @param {Object} res - Express response 对象
 * @param {string} message - 错误消息
 * @param {number} retryAfter - 建议重试时间（秒）
 */
const tooManyRequests = (res, message = '请求过于频繁，请稍后再试', retryAfter = null) => {
  if (retryAfter) {
    res.setHeader('Retry-After', retryAfter);
  }
  
  res.status(429).json({
    code: 429,
    message,
    data: null,
    retryAfter,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  success,
  successWithPagination,
  error,
  validationError,
  unauthorized,
  forbidden,
  notFound,
  serverError,
  created,
  noContent,
  conflict,
  tooManyRequests
};
