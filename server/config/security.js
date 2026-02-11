/**
 * 安全配置模块
 * 集中管理JWT密钥和其他安全相关配置
 */

const crypto = require('crypto');

/**
 * 获取或生成JWT密钥
 * @returns {string} JWT密钥
 */
function getJWTSecret() {
  // 优先使用环境变量
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  // 生产环境必须设置JWT_SECRET
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ 严重错误: 生产环境必须设置JWT_SECRET环境变量！');
    process.exit(1);
  }

  // 开发环境：生成临时随机密钥并警告
  const tempSecret = crypto.randomBytes(32).toString('hex');
  console.warn('⚠️  警告: 未设置JWT_SECRET环境变量，使用临时随机密钥');
  console.warn('⚠️  请在.env文件中设置JWT_SECRET，否则服务器重启后所有token将失效');
  
  return tempSecret;
}

// 导出JWT密钥（单例模式，确保整个应用使用同一个密钥）
const JWT_SECRET = getJWTSecret();

/**
 * 获取JWT访问令牌有效期
 * @returns {string} 有效期（如 '2h', '7d'）
 */
function getJWTAccessExpiry() {
  return process.env.JWT_ACCESS_EXPIRY || '2h';
}

/**
 * 获取JWT刷新令牌有效期
 * @returns {string} 有效期（如 '7d', '30d'）
 */
function getJWTRefreshExpiry() {
  return process.env.JWT_REFRESH_EXPIRY || '7d';
}

/**
 * 获取密码加密轮数
 * @returns {number} bcrypt轮数
 */
function getBcryptRounds() {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS);
  return isNaN(rounds) ? 10 : rounds;
}

module.exports = {
  JWT_SECRET,
  getJWTAccessExpiry,
  getJWTRefreshExpiry,
  getBcryptRounds
};
