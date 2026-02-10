/**
 * 速率限制中间件
 * 防止暴力攻击和API滥用
 */
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

/**
 * 登录速率限制
 * 每15分钟最多10次登录尝试，基于学号/邮箱而非IP
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 10, // 最多10次请求
  message: {
    code: 429,
    message: '登录尝试次数过多，请15分钟后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // 基于用户标识符（学号或邮箱）而非IP
  keyGenerator: (req, res) => {
    const identifier = req.body.studentId || req.body.email || 'anonymous';
    const projectId = req.body.projectId || req.query.projectId || '';
    return `login:${projectId}:${identifier}`;
  }
});

/**
 * 选科提交速率限制
 * 每分钟最多3次提交
 */
const selectionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 3,
  message: {
    code: 429,
    message: '提交过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    const ip = ipKeyGenerator(req, res);
    const userId = req.user?.id || 'anonymous';
    return `selection:${ip}:${userId}`;
  }
});

/**
 * Excel导出速率限制
 * 每小时最多10次导出
 */
const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 10,
  message: {
    code: 429,
    message: '导出次数已达上限，请1小时后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    const ip = ipKeyGenerator(req, res);
    const userId = req.user?.id || 'anonymous';
    return `export:${ip}:${userId}`;
  }
});

/**
 * 通用API速率限制
 * 每分钟最多100次请求
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    code: 429,
    message: 'API请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * 注册速率限制
 * 每小时最多3次注册尝试
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    code: 429,
    message: '注册尝试次数过多，请1小时后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    const ip = ipKeyGenerator(req, res);
    return `register:${ip}`;
  }
});

/**
 * 密码重置速率限制
 * 每小时最多5次
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    code: 429,
    message: '密码重置请求过多，请1小时后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    const ip = ipKeyGenerator(req, res);
    return `password-reset:${ip}`;
  }
});

/**
 * 验证码发送速率限制
 * 每5分钟最多5次，仅基于邮箱限制（不使用IP）
 */
const verificationCodeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5分钟
  max: 5,
  message: {
    code: 429,
    message: '验证码请求过于频繁，请5分钟后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    // 只使用邮箱作为限制key，不使用IP
    const email = req.body?.email || 'anonymous';
    return `verification-code:${email}`;
  }
});

/**
 * 验证码登录速率限制
 * 每15分钟最多10次，基于邮箱而非IP
 */
const codeLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    code: 429,
    message: '验证码登录尝试过多，请15分钟后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    // 只使用邮箱，不使用IP
    const email = req.body?.email || 'anonymous';
    return `code-login:${email}`;
  }
});

/**
 * 学生批量导入速率限制
 * 每小时最多5次
 */
const importLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    code: 429,
    message: '批量导入次数已达上限，请1小时后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    const ip = ipKeyGenerator(req, res);
    const userId = req.user?.id || 'anonymous';
    return `import:${ip}:${userId}`;
  }
});

/**
 * 管理员创建操作速率限制
 * 每分钟最多10次
 */
const adminCreateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    code: 429,
    message: '创建操作过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    const ip = ipKeyGenerator(req, res);
    const userId = req.user?.id || 'anonymous';
    return `admin-create:${ip}:${userId}`;
  }
});

module.exports = {
  loginLimiter,
  selectionLimiter,
  exportLimiter,
  apiLimiter,
  registerLimiter,
  passwordResetLimiter,
  verificationCodeLimiter,
  codeLoginLimiter,
  importLimiter,
  adminCreateLimiter
};
