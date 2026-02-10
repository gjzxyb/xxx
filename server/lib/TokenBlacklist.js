/**
 * Token黑名单管理
 * 用于实现Token即时失效功能（登出、修改密码等场景）
 * 支持 Redis 存储（多实例部署）和内存存储（单实例）
 */
const redisConfig = require('../config/redis');

class TokenBlacklist {
  constructor() {
    // 内存存储作为降级方案
    this.blacklist = new Map();
    // Redis 键前缀
    this.redisPrefix = 'token_blacklist:';

    // 定期清理过期token（仅内存模式需要）
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
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
  _getRedisKey(token) {
    return `${this.redisPrefix}${token}`;
  }

  /**
   * 添加token到黑名单
   * @param {string} token - JWT token
   * @param {number} expiresAt - token过期时间戳
   */
  async add(token, expiresAt) {
    if (this._useRedis()) {
      return await this._addRedis(token, expiresAt);
    }
    return this._addMemory(token, expiresAt);
  }

  _addMemory(token, expiresAt) {
    this.blacklist.set(token, expiresAt);

    if (process.env.NODE_ENV === 'development') {
      console.log(`Token已加入黑名单，当前黑名单大小: ${this.blacklist.size}`);
    }
  }

  async _addRedis(token, expiresAt) {
    try {
      const redis = redisConfig.getRedisClient();
      const key = this._getRedisKey(token);
      const ttl = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));

      if (ttl > 0) {
        // 存储过期时间戳，设置自动过期
        await redis.setEx(key, ttl, expiresAt.toString());

        if (process.env.NODE_ENV === 'development') {
          console.log(`Token已加入Redis黑名单，TTL: ${ttl}秒`);
        }
      }
    } catch (error) {
      console.error('Redis add 错误:', error);
      // 降级到内存存储
      this._addMemory(token, expiresAt);
    }
  }

  /**
   * 检查token是否在黑名单中
   * @param {string} token - JWT token
   * @returns {boolean}
   */
  async isBlacklisted(token) {
    if (this._useRedis()) {
      return await this._isBlacklistedRedis(token);
    }
    return this._isBlacklistedMemory(token);
  }

  _isBlacklistedMemory(token) {
    if (!this.blacklist.has(token)) {
      return false;
    }

    const expiresAt = this.blacklist.get(token);
    const now = Date.now();

    // 如果token已过期，从黑名单移除
    if (now > expiresAt) {
      this.blacklist.delete(token);
      return false;
    }

    return true;
  }

  async _isBlacklistedRedis(token) {
    try {
      const redis = redisConfig.getRedisClient();
      const key = this._getRedisKey(token);
      const exists = await redis.exists(key);

      return exists === 1;
    } catch (error) {
      console.error('Redis isBlacklisted 错误:', error);
      // 降级到内存存储
      return this._isBlacklistedMemory(token);
    }
  }

  /**
   * 清理过期的token（仅内存模式）
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [token, expiresAt] of this.blacklist.entries()) {
      if (now > expiresAt) {
        this.blacklist.delete(token);
        cleaned++;
      }
    }

    // 安全性：仅在开发环境记录日志，避免生产环境泄露敏感信息
    if (cleaned > 0 && process.env.NODE_ENV === 'development') {
      console.log(`清理了 ${cleaned} 个过期token，当前黑名单大小: ${this.blacklist.size}`);
    }
  }

  /**
   * 获取黑名单统计信息
   */
  async getStats() {
    if (this._useRedis()) {
      try {
        const redis = redisConfig.getRedisClient();
        const keys = await redis.keys(`${this.redisPrefix}*`);

        return {
          size: keys.length,
          storage: 'redis',
          tokens: keys.slice(0, 10).map(key => ({
            token: key.replace(this.redisPrefix, '').substring(0, 20) + '...'
          }))
        };
      } catch (error) {
        console.error('Redis getStats 错误:', error);
      }
    }

    return {
      size: this.blacklist.size,
      storage: 'memory',
      tokens: Array.from(this.blacklist.entries()).map(([token, expiresAt]) => ({
        token: token.substring(0, 20) + '...',
        expiresAt: new Date(expiresAt).toISOString()
      }))
    };
  }
}

// 单例模式
const tokenBlacklist = new TokenBlacklist();

module.exports = tokenBlacklist;
