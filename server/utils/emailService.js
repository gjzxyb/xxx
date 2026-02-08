const nodemailer = require('nodemailer');

/**
 * 邮件服务工具
 * 用于发送验证码邮件
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
  }

  /**
   * 初始化邮件服务
   */
  async initialize() {
    try {
      // 从环境变量读取邮箱配置
      const config = {
        host: process.env.EMAIL_HOST || 'smtp.qq.com',
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      };

      // 检查配置是否完整
      if (!config.auth.user || !config.auth.pass) {
        console.warn('邮箱服务未配置，验证码登录功能将不可用');
        return false;
      }

      this.transporter = nodemailer.createTransport(config);
      
      // 验证连接配置
      await this.transporter.verify();
      this.initialized = true;
      console.log('邮件服务初始化成功');
      return true;
    } catch (error) {
      console.error('邮件服务初始化失败:', error.message);
      this.initialized = false;
      return false;
    }
  }

  /**
   * 发送验证码邮件
   * @param {string} email - 收件人邮箱
   * @param {string} code - 验证码
   * @param {number} expiryMinutes - 验证码有效期（分钟）
   */
  async sendVerificationCode(email, code, expiryMinutes = 5) {
    if (!this.initialized) {
      throw new Error('邮件服务未初始化或配置不完整');
    }

    const mailOptions = {
      from: `"分科自选系统" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '登录验证码 - 分科自选系统',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
            .code-box { background: white; border: 2px solid #0ea5e9; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
            .code { font-size: 32px; font-weight: bold; color: #0ea5e9; letter-spacing: 8px; font-family: 'Courier New', monospace; }
            .warning { color: #f59e0b; font-size: 14px; margin-top: 20px; }
            .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">📚 分科自选系统</h1>
              <p style="margin: 10px 0 0 0;">新高考 3+1+2 选科平台</p>
            </div>
            <div class="content">
              <h2 style="color: #0f172a;">您的登录验证码</h2>
              <p>您正在使用邮箱验证码登录分科自选系统，请使用以下验证码完成登录：</p>
              
              <div class="code-box">
                <div class="code">${code}</div>
                <p style="margin: 10px 0 0 0; color: #64748b; font-size: 14px;">验证码有效期：${expiryMinutes} 分钟</p>
              </div>
              
              <p class="warning">⚠️ 请勿将验证码透露给他人，包括系统管理员。</p>
              <p style="color: #64748b; font-size: 14px;">如果这不是您本人的操作，请忽略此邮件。</p>
            </div>
            <div class="footer">
              <p>此邮件由系统自动发送，请勿回复</p>
              <p>© 2024 分科自选系统 - 新高考选科平台</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('验证码邮件发送成功:', email);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('验证码邮件发送失败:', error);
      throw new Error('邮件发送失败，请稍后重试');
    }
  }

  /**
   * 检查邮件服务是否可用
   */
  isAvailable() {
    return this.initialized;
  }
}

// 导出单例
const emailService = new EmailService();
module.exports = emailService;
