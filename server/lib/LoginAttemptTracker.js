/**
 * 登录失败锁定机制
 * 防止暴力破解攻击
 * 支持内存存储和 Redis 存储双模式
 */
const redisConfig = require('../config/redis');

class LoginAttemptTracker {
  constructor() {
    // 存储登录尝试记录 { identifier: { attempts: number, lockedUntil: timestamp } }
    this.attempts = new Map();
    
    // 配置
    this.maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
    this.lockDuration = parseInt(process.env.LOGIN_LOCK_DURATION) || 15 * 60 * 1000; // 15分钟
    this.attemptWindow = parseInt(process.env.LOGIN_ATTEMPT_WINDOW) || 15 * 60 * 1000; // 15分钟内的尝试
    
    // Redis 键前缀
    this.redisPrefix = 'login_attempt:';
    
    // 定期清理过期记录（每10分钟，仅内存模式需要）
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
  _getRedisKey(identifier) {
    return `${this.redisPrefix}${identifier}`;
  }

  /**
   * 记录登录失败
   * @param {string} identifier - 标识符（邮箱、学号或IP）
   * @returns {Object} { locked: boolean, remainingAttempts: number, lockedUntil: Date|null }
   */
  async recordFailure(identifier) {
    if (this._useRedis()) {
      return await this._recordFailureRedis(identifier);
    }
    return this._recordFailureMemory(identifier);
  }

  _recordFailureMemory(identifier) {
    const now = Date.now();
    const record = this.attempts.get(identifier) || {
      attempts: 0,
      firstAttempt: now,
      lockedUntil: null
    };

    // 如果已被锁定
    if (record.lockedUntil && now < record.lockedUntil) {
      return {
        locked: true,
        remainingAttempts: 0,
        lockedUntil: new Date(record.lockedUntil),
        message: `账号已被锁定，请在 ${new Date(record.lockedUntil).toLocaleTimeString()} 后重试`
      };
    }

    // 如果超过时间窗口，重置计数
    if (now - record.firstAttempt > this.attemptWindow) {
      record.attempts = 0;
      record.firstAttempt = now;
      record.lockedUntil = null;
    }

    // 增加尝试次数
    record.attempts++;

    // 检查是否需要锁定
    if (record.attempts >= this.maxAttempts) {
      record.lockedUntil = now + this.lockDuration;
      this.attempts.set(identifier, record);
      
      console.warn(`⚠️  账号/IP已被锁定: ${identifier}，锁定至: ${new Date(record.lockedUntil).toISOString()}`);
      
      return {
        locked: true,
        remainingAttempts: 0,
        lockedUntil: new Date(record.lockedUntil),
        message: `登录失败次数过多，账号已被锁定 ${this.lockDuration / 60000} 分钟`
      };
    }

    this.attempts.set(identifier, record);

    return {
      locked: false,
      remainingAttempts: this.maxAttempts - record.attempts,
      lockedUntil: null,
      message: `登录失败，剩余尝试次数: ${this.maxAttempts - record.attempts}`
    };
  }

  async _recordFailureRedis(identifier) {
    try {
      const redis = redisConfig.getRedisClient();
      const key = this._getRedisKey(identifier);
      const now = Date.now();
      
      const data = await redis.get(key);
      const record = data ? JSON.parse(data) : {
        attempts: 0,
        firstAttempt: now,
        lockedUntil: null
      };

      // 如果已被锁定
      if (record.lockedUntil && now < record.lockedUntil) {
        return {
          locked: true,
          remainingAttempts: 0,
          lockedUntil: new Date(record.lockedUntil),
          message: `账号已被锁定，请在 ${new Date(record.lockedUntil).toLocaleTimeString()} 后重试`
        };
      }

      // 如果超过时间窗口，重置计数
      if (now - record.firstAttempt > this.attemptWindow) {
        record.attempts = 0;
        record.firstAttempt = now;
        record.lockedUntil = null;
      }

      // 增加尝试次数
      record.attempts++;

      // 检查是否需要锁定
      if (record.attempts >= this.maxAttempts) {
        record.lockedUntil = now + this.lockDuration;
        await redis.setEx(key, Math.ceil(this.lockDuration / 1000), JSON.stringify(record));
        
        console.warn(`⚠️  账号/IP已被锁定: ${identifier}，锁定至: ${new Date(record.lockedUntil).toISOString()}`);
        
        return {
          locked: true,
          remainingAttempts: 0,
          lockedUntil: new Date(record.lockedUntil),
          message: `登录失败次数过多，账号已被锁定 ${this.lockDuration / 60000} 分钟`
        };
      }

      await redis.setEx(key, Math.ceil(this.attemptWindow / 1000), JSON.stringify(record));

      return {
        locked: false,
        remainingAttempts: this.maxAttempts - record.attempts,
        lockedUntil: null,
        message: `登录失败，剩余尝试次数: ${this.maxAttempts - record.attempts}`
      };
    } catch (error) {
      console.error('Redis recordFailure 错误:', error);
      return this._recordFailureMemory(identifier);
    }
  }

  /**
   * 记录登录成功，清除失败记录
   * @param {string} identifier - 标识符
   */
  async recordSuccess(identifier) {
    if (this._useRedis()) {
      try {
        const redis = redisConfig.getRedisClient();
        const key = this._getRedisKey(identifier);
        await redis.del(key);
        return;
      } catch (error) {
        console.error('Redis recordSuccess 错误:', error);
      }
    }
    this.attempts.delete(identifier);
  }

  /**
   * 检查是否被锁定
   * @param {string} identifier - 标识符
   * @returns {Object|null}
   */
  async isLocked(identifier) {
    if (this._useRedis()) {
      return await this._isLockedRedis(identifier);
    }
    return this._isLockedMemory(identifier);
  }

  _isLockedMemory(identifier) {
    const record = this.attempts.get(identifier);
    if (!record) return null;

    const now = Date.now();
    
    // 检查锁定状态
    if (record.lockedUntil && now < record.lockedUntil) {
      return {
        locked: true,
        lockedUntil: new Date(record.lockedUntil),
        message: `账号已被锁定，请在 ${new Date(record.lockedUntil).toLocaleTimeString()} 后重试`
      };
    }

    return null;
  }

  async _isLockedRedis(identifier) {
    try {
      const redis = redisConfig.getRedisClient();
      const key = this._getRedisKey(identifier);
      const data = await redis.get(key);
      
      if (!data) return null;

      const record = JSON.parse(data);
      const now = Date.now();
      
      if (record.lockedUntil && now < record.lockedUntil) {
        return {
          locked: true,
          lockedUntil: new Date(record.lockedUntil),
          message: `账号已被锁定，请在 ${new Date(record.lockedUntil).toLocaleTimeString()} 后重试`
        };
      }

      return null;
    } catch (error) {
      console.error('Redis isLocked 错误:', error);
      return this._isLockedMemory(identifier);
    }
  }

  /**
   * 手动解锁（管理员操作）
   * @param {string} identifier - 标识符
   */
  async unlock(identifier) {
    if (this._useRedis()) {
      try {
        const redis = redisConfig.getRedisClient();
        const key = this._getRedisKey(identifier);
        await redis.del(key);
        console.log(`✓ 账号已解锁: ${identifier}`);
        return;
      } catch (error) {
        console.error('Redis unlock 错误:', error);
      }
    }
    this.attempts.delete(identifier);
    console.log(`✓ 账号已解锁: ${identifier}`);
  }

  /**
   * 清理过期记录
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [identifier, record] of this.attempts.entries()) {
      // 如果锁定已过期且超过时间窗口，删除记录
      if ((!record.lockedUntil || now > record.lockedUntil) && 
          (now - record.firstAttempt > this.attemptWindow * 2)) {
        this.attempts.delete(identifier);
        cleaned++;
      }
    }

    if (cleaned > 0 && process.env.NODE_ENV === 'development') {
      console.log(`清理了 ${cleaned} 条过期登录记录`);
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const now = Date.now();
    const locked = [];
    const attempts = [];

    for (const [identifier, record] of this.attempts.entries()) {
      if (record.lockedUntil && now < record.lockedUntil) {
        locked.push({
          identifier,
          lockedUntil: new Date(record.lockedUntil).toISOString()
        });
      } else {
        attempts.push({
          identifier,
          attempts: record.attempts,
          remainingAttempts: this.maxAttempts - record.attempts
        });
      }
    }

    return { locked, attempts, total: this.attempts.size };
  }
}

// 单例模式
const loginAttemptTracker = new LoginAttemptTracker();

module.exports = loginAttemptTracker;
