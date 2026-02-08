/**
 * Redis 配置和连接管理
 * 用于替代内存存储，支持分布式部署
 */

let redisClient = null;
let isRedisAvailable = false;

/**
 * 初始化 Redis 连接
 */
async function initRedis() {
  // 如果未启用 Redis，直接返回
  if (!process.env.REDIS_ENABLED || process.env.REDIS_ENABLED !== 'true') {
    console.log('📦 Redis 未启用，使用内存存储模式');
    return;
  }

  try {
    // 动态导入 redis 模块（需要先安装：npm install redis）
    const redis = require('redis');
    
    const config = {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD || undefined,
      database: parseInt(process.env.REDIS_DB) || 0,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('❌ Redis 重连失败次数过多，放弃连接');
            return new Error('Redis 连接失败');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    };

    redisClient = redis.createClient(config);

    redisClient.on('error', (err) => {
      console.error('❌ Redis 错误:', err.message);
      isRedisAvailable = false;
    });

    redisClient.on('connect', () => {
      console.log('🔄 Redis 正在连接...');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis 连接成功');
      isRedisAvailable = true;
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis 重新连接中...');
      isRedisAvailable = false;
    });

    await redisClient.connect();
    
  } catch (error) {
    console.error('❌ Redis 初始化失败:', error.message);
    console.log('📦 降级到内存存储模式');
    isRedisAvailable = false;
    redisClient = null;
  }
}

/**
 * 获取 Redis 客户端
 */
function getRedisClient() {
  return redisClient;
}

/**
 * 检查 Redis 是否可用
 */
function isAvailable() {
  return isRedisAvailable && redisClient !== null;
}

/**
 * 关闭 Redis 连接
 */
async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('✅ Redis 连接已关闭');
    } catch (error) {
      console.error('❌ 关闭 Redis 连接失败:', error.message);
    }
  }
}

module.exports = {
  initRedis,
  getRedisClient,
  isAvailable,
  closeRedis
};
