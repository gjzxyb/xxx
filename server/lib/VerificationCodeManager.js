/**
 * 验证码管理器
 * 用于生成、存储和验证邮箱验证码
 * 支持内存存储和 Redis 存储双模式
 */
const redisConfig = require('../config/redis');

class VerificationCodeManager {
  constructor() {
    // 使用内存存储验证码 {email: {code, expiresAt, attempts}}
    this.codes = new Map();
    // 验证码有效期（默认5分钟）
    this.expiryMinutes = 5;
    // 最大尝试次数
    this.maxAttempts = 5;
    // 同一邮箱发送间隔（秒）
    // 开发环境：10秒；生产环境建议60秒
    this.sendInterval = process.env.NODE_ENV === 'production' ? 60 : 10;
    
    // Redis 键前缀
    this.redisPrefix = 'verification_code:';
    
    // 定期清理过期验证码（仅在内存模式下需要）
    setInterval(() => this.cleanup(), 60000); // 每分钟清理一次
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
  _getRedisKey(email) {
    return `${this.redisPrefix}${email}`;
  }

  /**
   * 生成6位数字验证码
   */
  generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 检查是否可以发送验证码（防止频繁发送）
   */
  async canSend(email) {
    if (this._useRedis()) {
      return await this._canSendRedis(email);
    }
    return this._canSendMemory(email);
  }

  _canSendMemory(email) {
    const record = this.codes.get(email);
    if (!record) return { allowed: true };

    const now = Date.now();
    const lastSent = record.sentAt || 0;
    const timeSinceLastSend = (now - lastSent) / 1000;

    if (timeSinceLastSend < this.sendInterval) {
      const remainingSeconds = Math.ceil(this.sendInterval - timeSinceLastSend);
      return {
        allowed: false,
        message: `请等待 ${remainingSeconds} 秒后再试`,
        remainingSeconds
      };
    }

    return { allowed: true };
  }

  async _canSendRedis(email) {
    try {
      const redis = redisConfig.getRedisClient();
      const key = this._getRedisKey(email);
      const data = await redis.get(key);
      
      if (!data) return { allowed: true };

      const record = JSON.parse(data);
      const now = Date.now();
      const lastSent = record.sentAt || 0;
      const timeSinceLastSend = (now - lastSent) / 1000;

      if (timeSinceLastSend < this.sendInterval) {
        const remainingSeconds = Math.ceil(this.sendInterval - timeSinceLastSend);
        return {
          allowed: false,
          message: `请等待 ${remainingSeconds} 秒后再试`,
          remainingSeconds
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Redis canSend 错误:', error);
      // Redis 失败时降级到内存存储
      return this._canSendMemory(email);
    }
  }

  /**
   * 存储验证码
   */
  async store(email, code) {
    if (this._useRedis()) {
      return await this._storeRedis(email, code);
    }
    return this._storeMemory(email, code);
  }

  _storeMemory(email, code) {
    const expiresAt = Date.now() + this.expiryMinutes * 60 * 1000;
    this.codes.set(email, {
      code,
      expiresAt,
      sentAt: Date.now(),
      attempts: 0
    });
  }

  async _storeRedis(email, code) {
    try {
      const redis = redisConfig.getRedisClient();
      const key = this._getRedisKey(email);
      const expiresAt = Date.now() + this.expiryMinutes * 60 * 1000;
      
      const data = JSON.stringify({
        code,
        expiresAt,
        sentAt: Date.now(),
        attempts: 0
      });

      // 设置数据并自动过期
      await redis.setEx(key, this.expiryMinutes * 60, data);
    } catch (error) {
      console.error('Redis store 错误:', error);
      // 降级到内存存储
      this._storeMemory(email, code);
    }
  }

  /**
   * 验证验证码
   */
  async verify(email, code) {
    if (this._useRedis()) {
      return await this._verifyRedis(email, code);
    }
    return this._verifyMemory(email, code);
  }

  _verifyMemory(email, code) {
    const record = this.codes.get(email);

    if (!record) {
      return {
        valid: false,
        message: '验证码不存在或已过期，请重新获取'
      };
    }

    // 检查是否过期
    if (Date.now() > record.expiresAt) {
      this.codes.delete(email);
      return {
        valid: false,
        message: '验证码已过期，请重新获取'
      };
    }

    // 检查尝试次数
    if (record.attempts >= this.maxAttempts) {
      this.codes.delete(email);
      return {
        valid: false,
        message: '验证码尝试次数过多，请重新获取'
      };
    }

    // 增加尝试次数
    record.attempts++;

    // 验证码不匹配
    if (record.code !== code) {
      const remaining = this.maxAttempts - record.attempts;
      return {
        valid: false,
        message: `验证码错误，还剩 ${remaining} 次尝试机会`,
        remainingAttempts: remaining
      };
    }

    // 验证成功，删除验证码
    this.codes.delete(email);
    return {
      valid: true,
      message: '验证成功'
    };
  }

  async _verifyRedis(email, code) {
    try {
      const redis = redisConfig.getRedisClient();
      const key = this._getRedisKey(email);
      const data = await redis.get(key);

      if (!data) {
        return {
          valid: false,
          message: '验证码不存在或已过期，请重新获取'
        };
      }

      const record = JSON.parse(data);

      // 检查是否过期
      if (Date.now() > record.expiresAt) {
        await redis.del(key);
        return {
          valid: false,
          message: '验证码已过期，请重新获取'
        };
      }

      // 检查尝试次数
      if (record.attempts >= this.maxAttempts) {
        await redis.del(key);
        return {
          valid: false,
          message: '验证码尝试次数过多，请重新获取'
        };
      }

      // 增加尝试次数
      record.attempts++;

      // 验证码不匹配
      if (record.code !== code) {
        // 更新尝试次数
        const ttl = await redis.ttl(key);
        if (ttl > 0) {
          await redis.setEx(key, ttl, JSON.stringify(record));
        }
        
        const remaining = this.maxAttempts - record.attempts;
        return {
          valid: false,
          message: `验证码错误，还剩 ${remaining} 次尝试机会`,
          remainingAttempts: remaining
        };
      }

      // 验证成功，删除验证码
      await redis.del(key);
      return {
        valid: true,
        message: '验证成功'
      };
    } catch (error) {
      console.error('Redis verify 错误:', error);
      // 降级到内存存储
      return this._verifyMemory(email, code);
    }
  }

  /**
   * 清理过期的验证码
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [email, record] of this.codes.entries()) {
      if (now > record.expiresAt) {
        this.codes.delete(email);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`清理了 ${cleaned} 个过期验证码`);
    }
  }

  /**
   * 获取验证码剩余有效时间（秒）
   */
  getRemainingTime(email) {
    const record = this.codes.get(email);
    if (!record) return 0;

    const remaining = Math.max(0, Math.floor((record.expiresAt - Date.now()) / 1000));
    return remaining;
  }

  /**
   * 删除指定邮箱的验证码
   */
  async remove(email) {
    if (this._useRedis()) {
      try {
        const redis = redisConfig.getRedisClient();
        const key = this._getRedisKey(email);
        await redis.del(key);
        return true;
      } catch (error) {
        console.error('Redis remove 错误:', error);
      }
    }
    return this.codes.delete(email);
  }

  /**
   * 获取当前存储的验证码数量（用于监控）
   */
  getCount() {
    return this.codes.size;
  }
}

// 导出单例
const verificationCodeManager = new VerificationCodeManager();
module.exports = verificationCodeManager;
