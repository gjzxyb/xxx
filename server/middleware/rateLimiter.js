const rateLimit = require('express-rate-limit');

/**
 * 速率限制配置
 * 防止暴力破解和DDoS攻击
 */

// 通用API速率限制
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: process.env.RATE_LIMIT_MAX || 100, // 限制每个IP 100个请求
  message: {
    code: 429,
    message: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true, // 返回 `RateLimit-*` headers
  legacyHeaders: false, // 禁用 `X-RateLimit-*` headers
  skip: (req) => {
    // 开发环境可以跳过限制
    return process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true';
  }
});

// 严格的登录/注册速率限制（防止暴力破解）
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: process.env.AUTH_RATE_LIMIT_MAX || 5, // 限制每个IP 5次尝试
  skipSuccessfulRequests: true, // 成功的请求不计入限制
  message: {
    code: 429,
    message: '登录尝试次数过多，请15分钟后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 密码重置限制
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 3, // 限制每个IP 3次
  message: {
    code: 429,
    message: '密码重置请求过多，请1小时后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 文件上传限制
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 10, // 限制每个IP 10次上传
  message: {
    code: 429,
    message: '上传请求过多，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 管理员操作限制（相对宽松，但仍有限制）
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 200, // 管理员操作较多
  message: {
    code: 429,
    message: '操作过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  apiLimiter,
  authLimiter,
  passwordResetLimiter,
  uploadLimiter,
  adminLimiter
};
