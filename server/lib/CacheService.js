/**
 * 缓存服务
 * 支持Redis和内存两种模式，自动降级
 */

const { getRedisClient, isAvailable } = require('../config/redis');

class CacheService {
  constructor() {
    // 内存缓存（Redis不可用时的降级方案）
    this.memoryCache = new Map();
    this.memoryExpiry = new Map();
  }

  /**
   * 获取缓存
   * @param {string} key - 缓存键
   * @returns {Promise<any|null>}
   */
  async get(key) {
    try {
      if (isAvailable()) {
        const redis = getRedisClient();
        const value = await redis.get(key);
        return value ? JSON.parse(value) : null;
      } else {
        // 降级到内存缓存
        return this._getFromMemory(key);
      }
    } catch (error) {
      console.error('缓存读取失败:', error.message);
      return null;
    }
  }

  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {number} ttl - 过期时间（秒），默认300秒
   * @returns {Promise<boolean>}
   */
  async set(key, value, ttl = 300) {
    try {
      if (isAvailable()) {
        const redis = getRedisClient();
        await redis.setEx(key, ttl, JSON.stringify(value));
        return true;
      } else {
        // 降级到内存缓存
        return this._setToMemory(key, value, ttl);
      }
    } catch (error) {
      console.error('缓存写入失败:', error.message);
      return false;
    }
  }

  /**
   * 删除缓存
   * @param {string} key - 缓存键
   * @returns {Promise<boolean>}
   */
  async del(key) {
    try {
      if (isAvailable()) {
        const redis = getRedisClient();
        await redis.del(key);
        return true;
      } else {
        // 降级到内存缓存
        this.memoryCache.delete(key);
        this.memoryExpiry.delete(key);
        return true;
      }
    } catch (error) {
      console.error('缓存删除失败:', error.message);
      return false;
    }
  }

  /**
   * 批量删除缓存（支持通配符）
   * @param {string} pattern - 缓存键模式（如 "project:123:*"）
   * @returns {Promise<number>} 删除的键数量
   */
  async delPattern(pattern) {
    try {
      if (isAvailable()) {
        const redis = getRedisClient();
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(keys);
        }
        return keys.length;
      } else {
        // 降级到内存缓存
        let count = 0;
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        for (const key of this.memoryCache.keys()) {
          if (regex.test(key)) {
            this.memoryCache.delete(key);
            this.memoryExpiry.delete(key);
            count++;
          }
        }
        return count;
      }
    } catch (error) {
      console.error('批量删除缓存失败:', error.message);
      return 0;
    }
  }

  /**
   * 清空所有缓存
   * @returns {Promise<boolean>}
   */
  async flush() {
    try {
      if (isAvailable()) {
        const redis = getRedisClient();
        await redis.flushDb();
        return true;
      } else {
        this.memoryCache.clear();
        this.memoryExpiry.clear();
        return true;
      }
    } catch (error) {
      console.error('清空缓存失败:', error.message);
      return false;
    }
  }

  /**
   * 从内存缓存读取
   * @private
   */
  _getFromMemory(key) {
    const expiry = this.memoryExpiry.get(key);
    if (expiry && Date.now() > expiry) {
      // 已过期
      this.memoryCache.delete(key);
      this.memoryExpiry.delete(key);
      return null;
    }
    return this.memoryCache.get(key) || null;
  }

  /**
   * 写入内存缓存
   * @private
   */
  _setToMemory(key, value, ttl) {
    this.memoryCache.set(key, value);
    this.memoryExpiry.set(key, Date.now() + ttl * 1000);
    return true;
  }

  /**
   * 定期清理过期的内存缓存
   * @private
   */
  _startMemoryCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, expiry] of this.memoryExpiry.entries()) {
        if (now > expiry) {
          this.memoryCache.delete(key);
          this.memoryExpiry.delete(key);
        }
      }
    }, 60000); // 每分钟清理一次
  }

  /**
   * 生成项目级缓存键
   * @param {string} projectId - 项目ID
   * @param {string} suffix - 键后缀
   * @returns {string}
   */
  projectKey(projectId, suffix) {
    return `project:${projectId}:${suffix}`;
  }

  /**
   * 生成平台级缓存键
   * @param {string} suffix - 键后缀
   * @returns {string}
   */
  platformKey(suffix) {
    return `platform:${suffix}`;
  }
}

// 导出单例
const cacheService = new CacheService();
cacheService._startMemoryCleanup();

module.exports = cacheService;
