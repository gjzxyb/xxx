/**
 * 文件上传验证中间件
 * 明确限制文件类型和大小，防止恶意文件上传
 */

/**
 * 允许的文件类型配置
 */
const ALLOWED_FILE_TYPES = {
  // 图片类型
  image: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    maxSize: 5 * 1024 * 1024 // 5MB
  },
  
  // Excel文件（用于学生批量导入）
  excel: {
    mimeTypes: [
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'text/csv'
    ],
    extensions: ['.xls', '.xlsx', '.csv'],
    maxSize: 10 * 1024 * 1024 // 10MB
  },
  
  // 文档类型
  document: {
    mimeTypes: [
      'application/pdf',
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
    ],
    extensions: ['.pdf', '.doc', '.docx'],
    maxSize: 20 * 1024 * 1024 // 20MB
  }
};

/**
 * 验证文件类型
 * @param {Object} file - multer文件对象
 * @param {string} allowedType - 允许的文件类型类别 (image, excel, document)
 * @returns {Object} { valid: boolean, message: string }
 */
function validateFileType(file, allowedType = 'excel') {
  if (!file) {
    return { valid: false, message: '未检测到文件' };
  }

  const config = ALLOWED_FILE_TYPES[allowedType];
  if (!config) {
    return { valid: false, message: '无效的文件类型配置' };
  }

  // 检查MIME类型
  if (!config.mimeTypes.includes(file.mimetype)) {
    return {
      valid: false,
      message: `不支持的文件类型。允许的类型: ${config.mimeTypes.join(', ')}`
    };
  }

  // 检查文件扩展名
  const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  if (!config.extensions.includes(ext)) {
    return {
      valid: false,
      message: `不支持的文件扩展名。允许的扩展名: ${config.extensions.join(', ')}`
    };
  }

  // 检查文件大小
  if (file.size > config.maxSize) {
    const maxSizeMB = (config.maxSize / (1024 * 1024)).toFixed(2);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      message: `文件大小超出限制。最大允许: ${maxSizeMB}MB，当前文件: ${fileSizeMB}MB`
    };
  }

  return { valid: true, message: '文件验证通过' };
}

/**
 * 创建文件上传验证中间件
 * @param {string} allowedType - 允许的文件类型 (image, excel, document)
 * @returns {Function} Express中间件
 */
function createFileValidator(allowedType = 'excel') {
  return (req, res, next) => {
    // 检查是否有文件上传
    if (!req.file && !req.files) {
      return res.status(400).json({
        code: 400,
        message: '请上传文件'
      });
    }

    // 单文件上传验证
    if (req.file) {
      const validation = validateFileType(req.file, allowedType);
      if (!validation.valid) {
        return res.status(400).json({
          code: 400,
          message: validation.message
        });
      }
    }

    // 多文件上传验证
    if (req.files) {
      const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
      
      for (const file of files) {
        const validation = validateFileType(file, allowedType);
        if (!validation.valid) {
          return res.status(400).json({
            code: 400,
            message: `文件 "${file.originalname}" 验证失败: ${validation.message}`
          });
        }
      }
    }

    next();
  };
}

/**
 * 安全的文件名生成器
 * 防止路径遍历攻击
 */
function sanitizeFilename(filename) {
  // 移除路径分隔符和特殊字符
  return filename
    .replace(/[\/\\]/g, '') // 移除路径分隔符
    .replace(/[<>:"|?*]/g, '') // 移除Windows不允许的字符
    .replace(/\.\./g, '') // 防止路径遍历
    .trim();
}

/**
 * 生成唯一文件名
 * @param {string} originalName - 原始文件名
 * @returns {string} 唯一文件名
 */
function generateUniqueFilename(originalName) {
  const crypto = require('crypto');
  const ext = originalName.substring(originalName.lastIndexOf('.'));
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `${timestamp}-${random}${ext}`;
}

module.exports = {
  ALLOWED_FILE_TYPES,
  validateFileType,
  createFileValidator,
  sanitizeFilename,
  generateUniqueFilename
};
