/**
 * 验证码管理器
 * 用于生成、存储和验证邮箱验证码
 */
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
    
    // 定期清理过期验证码
    setInterval(() => this.cleanup(), 60000); // 每分钟清理一次
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
  canSend(email) {
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

  /**
   * 存储验证码
   */
  store(email, code) {
    const expiresAt = Date.now() + this.expiryMinutes * 60 * 1000;
    this.codes.set(email, {
      code,
      expiresAt,
      sentAt: Date.now(),
      attempts: 0
    });
  }

  /**
   * 验证验证码
   */
  verify(email, code) {
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
  remove(email) {
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
