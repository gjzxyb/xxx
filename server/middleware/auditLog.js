/**
 * 审计日志中间件
 * 记录关键操作用于安全审计
 */

const fs = require('fs');
const path = require('path');

class AuditLogger {
  constructor() {
    this.logDir = process.env.AUDIT_LOG_DIR || path.join(__dirname, '../logs/audit');
    this.ensureLogDir();
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * 记录审计日志
   * @param {Object} logEntry - 日志条目
   */
  log(logEntry) {
    const timestamp = new Date().toISOString();
    const logFile = path.join(this.logDir, `audit-${this.getDateString()}.log`);
    
    const entry = {
      timestamp,
      ...logEntry
    };

    // 写入文件
    fs.appendFileSync(
      logFile,
      JSON.stringify(entry) + '\n',
      { encoding: 'utf8' }
    );

    // 开发环境同时输出到控制台
    if (process.env.NODE_ENV === 'development') {
      console.log('📋 审计日志:', entry);
    }
  }

  getDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  /**
   * 清理旧日志文件
   * @param {number} daysToKeep - 保留天数
   */
  cleanup(daysToKeep = 90) {
    const files = fs.readdirSync(this.logDir);
    const now = Date.now();
    const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

    files.forEach(file => {
      const filePath = path.join(this.logDir, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
        console.log(`清理旧审计日志: ${file}`);
      }
    });
  }
}

const auditLogger = new AuditLogger();

/**
 * 审计日志中间件
 */
const auditLog = (action) => {
  return (req, res, next) => {
    // 记录请求信息
    const logEntry = {
      action,
      method: req.method,
      path: req.path,
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      body: sanitizeBody(req.body)
    };

    // 保存原始的 res.json 方法
    const originalJson = res.json.bind(res);

    // 重写 res.json 以捕获响应
    res.json = function(data) {
      logEntry.statusCode = res.statusCode;
      logEntry.success = res.statusCode >= 200 && res.statusCode < 300;
      logEntry.responseCode = data?.code;
      
      // 记录日志
      auditLogger.log(logEntry);
      
      // 调用原始方法
      return originalJson(data);
    };

    next();
  };
};

/**
 * 清理敏感字段
 */
function sanitizeBody(body) {
  if (!body) return {};
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'newPassword', 'oldPassword', 'token', 'captchaAnswer'];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  });

  return sanitized;
}

module.exports = {
  auditLogger,
  auditLog
};
