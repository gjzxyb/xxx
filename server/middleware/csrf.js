/**
 * CSRF 保护中间件
 * 防止跨站请求伪造攻击
 * 支持 Redis 存储（多实例部署）和内存存储（单实例）
 */
const crypto = require('crypto');
const redisConfig = require('../config/redis');

class CSRFProtection {
  constructor() {
    // 内存存储作为降级方案
    this.tokens = new Map();
    // Token 有效期（默认1小时）
    this.tokenExpiry = 60 * 60 * 1000;
    this.tokenExpirySeconds = 60 * 60;
    // Redis 键前缀
    this.redisPrefix = 'csrf_token:';

    // 定期清理过期 token（仅内存模式需要）
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  /**
   * 检查是否使用 Redis
   */
  _useRedis() {
    return redisConfig.isAvailable();
  }

  /**
   * 获取 Redis 键名
   */
  _getRedisKey(sessionId) {
    return `${this.redisPrefix}${sessionId}`;
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
  async createToken(sessionId) {
    const token = this.generateToken();

    if (this._useRedis()) {
      return await this._createTokenRedis(sessionId, token);
    }
    return this._createTokenMemory(sessionId, token);
  }

  _createTokenMemory(sessionId, token) {
    this.tokens.set(sessionId, {
      token,
      createdAt: Date.now()
    });
    return token;
  }

  async _createTokenRedis(sessionId, token) {
    try {
      const redis = redisConfig.getRedisClient();
      const key = this._getRedisKey(sessionId);
      const data = JSON.stringify({
        token,
        createdAt: Date.now()
      });

      // 设置数据并自动过期
      await redis.setEx(key, this.tokenExpirySeconds, data);
      return token;
    } catch (error) {
      console.error('Redis createToken 错误:', error);
      // 降级到内存存储
      return this._createTokenMemory(sessionId, token);
    }
  }

  /**
   * 验证 CSRF token
   */
  async verifyToken(sessionId, token) {
    if (this._useRedis()) {
      return await this._verifyTokenRedis(sessionId, token);
    }
    return this._verifyTokenMemory(sessionId, token);
  }

  _verifyTokenMemory(sessionId, token) {
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

  async _verifyTokenRedis(sessionId, token) {
    try {
      const redis = redisConfig.getRedisClient();
      const key = this._getRedisKey(sessionId);
      const data = await redis.get(key);

      if (!data) {
        return false;
      }

      const record = JSON.parse(data);

      // 检查是否过期
      if (Date.now() - record.createdAt > this.tokenExpiry) {
        await redis.del(key);
        return false;
      }

      // 验证 token
      return record.token === token;
    } catch (error) {
      console.error('Redis verifyToken 错误:', error);
      // 降级到内存存储
      return this._verifyTokenMemory(sessionId, token);
    }
  }

  /**
   * 删除 token
   */
  async removeToken(sessionId) {
    if (this._useRedis()) {
      try {
        const redis = redisConfig.getRedisClient();
        const key = this._getRedisKey(sessionId);
        await redis.del(key);
        return true;
      } catch (error) {
        console.error('Redis removeToken 错误:', error);
      }
    }
    return this.tokens.delete(sessionId);
  }

  /**
   * 清理过期 token（仅内存模式）
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
 * 生成或获取会话ID
 */
function getOrCreateSessionId(req, res) {
  const cookieName = 'SESSION-ID';
  let sessionId = req.cookies?.[cookieName];

  if (!sessionId) {
    // 生成新的会话ID
    sessionId = 'anon_' + crypto.randomBytes(16).toString('hex');
    // 设置到 cookie（长期有效）
    res.cookie(cookieName, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30天
    });
  }

  return sessionId;
}

/**
 * CSRF 保护中间件 - 为请求添加 CSRF token
 */
async function csrfMiddleware(req, res, next) {
  try {
    // 使用基于 cookie 的 session ID（更加稳定）
    const sessionId = req.user?.id || getOrCreateSessionId(req, res);

    // 如果没有 token，创建一个
    let token = req.cookies?.['CSRF-TOKEN'];

    // 验证现有 token（如果存在）
    let isValid = false;
    if (token) {
      try {
        isValid = await csrfProtection.verifyToken(sessionId, token);
      } catch (err) {
        console.error('CSRF token 验证错误:', err);
        isValid = false;
      }
    }

    // 如果 token 不存在或无效，创建新的
    if (!token || !isValid) {
      try {
        token = await csrfProtection.createToken(sessionId);
      } catch (err) {
        console.error('CSRF token 创建错误:', err);
        // 即使创建失败，也继续执行，不阻止请求
        return next();
      }
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
  } catch (error) {
    console.error('CSRF 中间件错误:', error);
    // 即使出错也继续执行，不阻止请求
    next();
  }
}

/**
 * CSRF 验证中间件 - 验证请求中的 CSRF token
 */
async function csrfVerify(req, res, next) {
  try {
    // GET、HEAD、OPTIONS 请求不需要验证
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // 使用相同的 session ID 获取逻辑
    const sessionId = req.user?.id || req.cookies?.['SESSION-ID'] || req.ip;

    // 从请求头或请求体获取 token
    const token = req.headers['x-csrf-token'] ||
                  req.body?._csrf ||
                  req.query?._csrf;

    if (!token) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('CSRF 验证: token 缺失', {
          method: req.method,
          path: req.path
        });
      }
      return res.status(403).json({
        code: 403,
        message: 'CSRF token 缺失'
      });
    }

    let isValid = false;
    try {
      isValid = await csrfProtection.verifyToken(sessionId, token);
    } catch (err) {
      console.error('CSRF 验证错误:', err);
      return res.status(500).json({
        code: 500,
        message: '服务器错误'
      });
    }

    if (!isValid) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('CSRF 验证: token 无效', {
          method: req.method,
          path: req.path
        });
      }
      return res.status(403).json({
        code: 403,
        message: 'CSRF token 无效或已过期'
      });
    }

    next();
  } catch (error) {
    console.error('CSRF 验证错误:', error);
    return res.status(500).json({
      code: 500,
      message: '服务器错误'
    });
  }
}

/**
 * 清理指定会话的 token
 */
async function clearToken(sessionId) {
  await csrfProtection.removeToken(sessionId);
}

module.exports = {
  csrfMiddleware,
  csrfVerify,
  clearToken
};
