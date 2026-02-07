/**
 * Token黑名单管理
 * 用于实现Token即时失效功能（登出、修改密码等场景）
 */

class TokenBlacklist {
  constructor() {
    // 使用Map存储黑名单token（生产环境应使用Redis）
    this.blacklist = new Map();
    
    // 定期清理过期token（每小时）
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  /**
   * 添加token到黑名单
   * @param {string} token - JWT token
   * @param {number} expiresAt - token过期时间戳
   */
  add(token, expiresAt) {
    this.blacklist.set(token, expiresAt);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`Token已加入黑名单，当前黑名单大小: ${this.blacklist.size}`);
    }
  }

  /**
   * 检查token是否在黑名单中
   * @param {string} token - JWT token
   * @returns {boolean}
   */
  isBlacklisted(token) {
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

  /**
   * 清理过期的token
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

    if (cleaned > 0 && process.env.NODE_ENV === 'development') {
      console.log(`清理了 ${cleaned} 个过期token，当前黑名单大小: ${this.blacklist.size}`);
    }
  }

  /**
   * 获取黑名单统计信息
   */
  getStats() {
    return {
      size: this.blacklist.size,
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
