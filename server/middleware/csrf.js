/**
 * CSRF 保护中间件
 * 防止跨站请求伪造攻击
 */
const crypto = require('crypto');

class CSRFProtection {
  constructor() {
    // 存储 CSRF tokens {sessionId: token}
    this.tokens = new Map();
    // Token 有效期（默认1小时）
    this.tokenExpiry = 60 * 60 * 1000;
    
    // 定期清理过期 token
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  /**
   * 生成 CSRF token
   */
  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * 为会话创建 token
   */
  createToken(sessionId) {
    const token = this.generateToken();
    this.tokens.set(sessionId, {
      token,
      createdAt: Date.now()
    });
    return token;
  }

  /**
   * 验证 CSRF token
   */
  verifyToken(sessionId, token) {
    const record = this.tokens.get(sessionId);
    
    if (!record) {
      return false;
    }

    // 检查是否过期
    if (Date.now() - record.createdAt > this.tokenExpiry) {
      this.tokens.delete(sessionId);
      return false;
    }

    // 验证 token
    return record.token === token;
  }

  /**
   * 删除 token
   */
  removeToken(sessionId) {
    this.tokens.delete(sessionId);
  }

  /**
   * 清理过期 token
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, record] of this.tokens.entries()) {
      if (now - record.createdAt > this.tokenExpiry) {
        this.tokens.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0 && process.env.NODE_ENV === 'development') {
      console.log(`清理了 ${cleaned} 个过期 CSRF token`);
    }
  }
}

// 创建单例
const csrfProtection = new CSRFProtection();

/**
 * CSRF 保护中间件 - 为请求添加 CSRF token
 */
function csrfMiddleware(req, res, next) {
  // 从 JWT token 或 session 获取唯一标识
  const sessionId = req.user?.id || req.ip;
  
  // 如果没有 token，创建一个
  let token = req.cookies?.['CSRF-TOKEN'];
  if (!token || !csrfProtection.verifyToken(sessionId, token)) {
    token = csrfProtection.createToken(sessionId);
  }

  // 设置 cookie
  res.cookie('CSRF-TOKEN', token, {
    httpOnly: false, // 允许 JavaScript 读取
    secure: process.env.NODE_ENV === 'production', // 生产环境仅 HTTPS
    sameSite: 'strict',
    maxAge: 60 * 60 * 1000 // 1小时
  });

  // 将 token 附加到响应头（供客户端读取）
  res.setHeader('X-CSRF-TOKEN', token);

  next();
}

/**
 * CSRF 验证中间件 - 验证请求中的 CSRF token
 */
function csrfVerify(req, res, next) {
  // GET、HEAD、OPTIONS 请求不需要验证
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const sessionId = req.user?.id || req.ip;
  
  // 从请求头或请求体获取 token
  const token = req.headers['x-csrf-token'] || 
                req.body?._csrf || 
                req.query?._csrf;

  if (!token) {
    return res.status(403).json({
      code: 403,
      message: 'CSRF token 缺失'
    });
  }

  if (!csrfProtection.verifyToken(sessionId, token)) {
    return res.status(403).json({
      code: 403,
      message: 'CSRF token 无效或已过期'
    });
  }

  next();
}

/**
 * 清理指定会话的 token
 */
function clearToken(sessionId) {
  csrfProtection.removeToken(sessionId);
}

module.exports = {
  csrfMiddleware,
  csrfVerify,
  clearToken
};
