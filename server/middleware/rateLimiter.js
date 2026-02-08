/**
 * 速率限制中间件
 * 防止 API 滥用和暴力破解攻击
 */
const rateLimit = require('express-rate-limit');

/**
 * 通用 API 速率限制
 * 15分钟内最多 100 个请求
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制请求数
  message: {
    code: 429,
    message: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true, // 返回速率限制信息在 `RateLimit-*` 头中
  legacyHeaders: false, // 禁用 `X-RateLimit-*` 头
  // 跳过成功的健康检查请求
  skip: (req) => {
    return req.path === '/api/health';
  }
});

/**
 * 认证接口速率限制（更严格）
 * 15分钟内最多 5 次登录/注册尝试
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 限制请求数
  message: {
    code: 429,
    message: '登录尝试过多，请15分钟后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // 成功的请求不计入限制
});

/**
 * 管理员操作速率限制
 * 15分钟内最多 50 个请求
 */
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    code: 429,
    message: '管理操作过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * 验证码发送速率限制（非常严格）
 * 1小时内最多 3 次
 */
const verificationCodeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 3,
  message: {
    code: 429,
    message: '验证码发送次数过多，请1小时后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * 密码重置速率限制
 * 1小时内最多 3 次
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    code: 429,
    message: '密码重置请求过多，请1小时后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * 文件上传速率限制
 * 1小时内最多 20 次
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: {
    code: 429,
    message: '文件上传次数过多，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * 严格的速率限制（用于敏感操作）
 * 1小时内最多 10 次
 */
const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
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
  adminLimiter,
  verificationCodeLimiter,
  passwordResetLimiter,
  uploadLimiter,
  strictLimiter
};
