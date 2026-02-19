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
   * 发送密码重置邮件
   * @param {string} email - 收件人邮箱
   * @param {string} studentId - 学号
   * @param {string} newPassword - 新密码
   */
  async sendPasswordReset(email, studentId, newPassword) {
    if (!this.initialized) {
      throw new Error('邮件服务未初始化或配置不完整');
    }

    const mailOptions = {
      from: `"分科自选系统" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '密码重置通知 - 分科自选系统',
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
            .password-box { background: white; border: 2px solid #0ea5e9; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
            .password { font-size: 24px; font-weight: bold; color: #0ea5e9; letter-spacing: 2px; font-family: 'Courier New', monospace; }
            .warning { color: #f59e0b; font-size: 14px; margin-top: 20px; }
            .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">📚 分科自选系统</h1>
              <p style="margin: 10px 0 0 0;">密码重置通知</p>
            </div>
            <div class="content">
              <h2 style="color: #0f172a;">您的密码已重置</h2>
              <p>尊敬的 <strong>${studentId}</strong> 同学，</p>
              <p>您的账号密码已由管理员重置。请使用以下新密码登录系统：</p>

              <div class="password-box">
                <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">新密码</p>
                <div class="password">${newPassword}</div>
              </div>

              <p class="warning">⚠️ 为了您的账号安全，请在首次登录后立即修改密码。</p>
              <p style="color: #64748b; font-size: 14px;">如果这不是您本人的操作，请立即联系管理员。</p>
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
      console.log('密码重置邮件发送成功:', email);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('密码重置邮件发送失败:', error);
      throw new Error('邮件发送失败，请稍后重试');
    }
  }

  /**
   * 发送选科确认邮件
   * @param {string} email - 收件人邮箱
   * @param {Object} student - 学生信息
   * @param {Object} selection - 选科信息
   */
  async sendSelectionConfirmation(email, student, selection) {
    if (!this.initialized) {
      throw new Error('邮件服务未初始化或配置不完整');
    }

    const mailOptions = {
      from: `"分科自选系统" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '选科确认通知 - 分科自选系统',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
            .selection-box { background: white; border: 2px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .subject-item { padding: 10px; margin: 5px 0; background: #f0fdf4; border-left: 4px solid #10b981; }
            .subject-label { color: #059669; font-weight: bold; }
            .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">✅ 选科成功</h1>
              <p style="margin: 10px 0 0 0;">您的选科已确认</p>
            </div>
            <div class="content">
              <h2 style="color: #0f172a;">选科确认</h2>
              <p>尊敬的 <strong>${student.name}</strong> 同学（学号：${student.studentId}），</p>
              <p>您的选科已成功提交并确认。以下是您的选科信息：</p>

              <div class="selection-box">
                <div class="subject-item">
                  <span class="subject-label">首选科目：</span>
                  <span>${selection.physicsHistorySubject?.name || '未选择'}</span>
                </div>
                <div class="subject-item">
                  <span class="subject-label">再选科目1：</span>
                  <span>${selection.electiveOneSubject?.name || '未选择'}</span>
                </div>
                <div class="subject-item">
                  <span class="subject-label">再选科目2：</span>
                  <span>${selection.electiveTwoSubject?.name || '未选择'}</span>
                </div>
                <p style="margin-top: 15px; color: #64748b; font-size: 14px;">
                  提交时间：${new Date(selection.submittedAt).toLocaleString('zh-CN')}
                </p>
              </div>

              <p style="color: #059669; font-weight: bold;">📌 请仔细核对您的选科信息，如有疑问请及时联系老师。</p>
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
      console.log('选科确认邮件发送成功:', email);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('选科确认邮件发送失败:', error);
      throw new Error('邮件发送失败，请稍后重试');
    }
  }

  /**
   * 发送选科提醒邮件
   * @param {string} email - 收件人邮箱
   * @param {Object} student - 学生信息
   * @param {Date} deadline - 截止时间
   */
  async sendSelectionReminder(email, student, deadline) {
    if (!this.initialized) {
      throw new Error('邮件服务未初始化或配置不完整');
    }

    const mailOptions = {
      from: `"分科自选系统" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '选科提醒 - 分科自选系统',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
            .deadline-box { background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
            .deadline { font-size: 24px; font-weight: bold; color: #d97706; }
            .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">⏰ 选科提醒</h1>
              <p style="margin: 10px 0 0 0;">请尽快完成选科</p>
            </div>
            <div class="content">
              <h2 style="color: #0f172a;">温馨提醒</h2>
              <p>尊敬的 <strong>${student.name}</strong> 同学（学号：${student.studentId}），</p>
              <p>系统检测到您尚未完成选科，请尽快登录系统完成选科操作。</p>

              <div class="deadline-box">
                <p style="margin: 0 0 10px 0; color: #92400e; font-size: 14px;">选科截止时间</p>
                <div class="deadline">${new Date(deadline).toLocaleString('zh-CN')}</div>
              </div>

              <p style="color: #d97706; font-weight: bold;">⚠️ 请在截止时间前完成选科，逾期将无法提交。</p>
              <p style="color: #64748b; font-size: 14px;">如有任何问题，请及时联系班主任或教务处。</p>
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
      console.log('选科提醒邮件发送成功:', email);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('选科提醒邮件发送失败:', error);
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
