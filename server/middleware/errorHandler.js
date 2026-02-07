/**
 * 统一错误处理中间件
 * 避免泄露敏感信息，提供用户友好的错误响应
 */

class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

// 错误处理中间件
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  // 开发环境：记录详细错误
  if (process.env.NODE_ENV === 'development') {
    console.error('错误详情:', {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      body: req.body,
      user: req.user?.id
    });
  }

  // 生产环境：只记录必要信息
  if (process.env.NODE_ENV === 'production') {
    console.error('错误:', {
      message: err.message,
      url: req.url,
      method: req.method,
      statusCode: error.statusCode,
      timestamp: new Date().toISOString()
    });
  }

  // Sequelize 验证错误
  if (err.name === 'SequelizeValidationError') {
    error.statusCode = 400;
    error.message = '数据验证失败';
  }

  // Sequelize 唯一约束错误
  if (err.name === 'SequelizeUniqueConstraintError') {
    error.statusCode = 400;
    error.message = '该记录已存在';
  }

  // JWT 错误
  if (err.name === 'JsonWebTokenError') {
    error.statusCode = 401;
    error.message = '无效的认证令牌';
  }

  if (err.name === 'TokenExpiredError') {
    error.statusCode = 401;
    error.message = '认证令牌已过期';
  }

  // 数据库连接错误
  if (err.name === 'SequelizeConnectionError') {
    error.statusCode = 503;
    error.message = '服务暂时不可用，请稍后重试';
  }

  // 构建响应
  const response = {
    code: error.statusCode,
    message: error.message || '服务器内部错误',
    timestamp: new Date().toISOString()
  };

  // 开发环境返回堆栈跟踪
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.details = {
      name: err.name,
      isOperational: err.isOperational
    };
  }

  res.status(error.statusCode).json(response);
};

// 404 错误处理
const notFound = (req, res, next) => {
  // 忽略浏览器自动请求，避免控制台噪音
  const ignoredPaths = [
    '/favicon.ico',
    '/.well-known/appspecific/com.chrome.devtools.json'
  ];
  
  if (ignoredPaths.includes(req.originalUrl)) {
    return res.status(204).end();
  }
  
  const error = new AppError(`路径不存在: ${req.originalUrl}`, 404);
  next(error);
};

// 异步错误包装器
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  AppError,
  errorHandler,
  notFound,
  asyncHandler
};
