/**
 * 密码强度策略中间件
 * 用于验证密码是否符合安全标准
 */

// 密码策略配置
const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 32,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false,  // 可选
  forbiddenPatterns: ['123456', 'password', 'qwerty', 'admin', 'abc123']
};

/**
 * 验证密码强度
 * @param {string} password - 待验证的密码
 * @returns {Object} { isValid: boolean, errors: string[], strength: string }
 */
function validatePassword(password) {
  const errors = [];
  
  // 检查密码是否为空
  if (!password) {
    return { isValid: false, errors: ['密码不能为空'], strength: 'weak' };
  }

  // 检查长度
  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`密码至少需要${PASSWORD_POLICY.minLength}位`);
  }
  if (password.length > PASSWORD_POLICY.maxLength) {
    errors.push(`密码最多${PASSWORD_POLICY.maxLength}位`);
  }

  // 检查大写字母
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('密码需要包含至少一个大写字母');
  }

  // 检查小写字母
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('密码需要包含至少一个小写字母');
  }

  // 检查数字
  if (PASSWORD_POLICY.requireNumber && !/[0-9]/.test(password)) {
    errors.push('密码需要包含至少一个数字');
  }

  // 检查特殊字符（可选）
  if (PASSWORD_POLICY.requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('密码需要包含至少一个特殊字符');
  }

  // 检查禁止的常见密码
  const lowerPassword = password.toLowerCase();
  for (const pattern of PASSWORD_POLICY.forbiddenPatterns) {
    if (lowerPassword.includes(pattern)) {
      errors.push('密码过于简单，请使用更复杂的密码');
      break;
    }
  }

  // 计算密码强度
  const strength = calculatePasswordStrength(password);

  return { 
    isValid: errors.length === 0, 
    errors,
    strength
  };
}

/**
 * 计算密码强度
 * @param {string} password 
 * @returns {string} 'weak' | 'medium' | 'strong'
 */
function calculatePasswordStrength(password) {
  let score = 0;

  // 长度分数
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // 字符类型分数
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;

  // 复杂度检查
  const hasSequential = /(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password);
  const hasRepeating = /(.)\1{2,}/.test(password);
  
  if (!hasSequential) score += 1;
  if (!hasRepeating) score += 1;

  // 根据分数返回强度等级
  if (score <= 3) return 'weak';
  if (score <= 6) return 'medium';
  return 'strong';
}

/**
 * Express 中间件：验证请求中的密码
 */
function validatePasswordMiddleware(req, res, next) {
  const { password, newPassword } = req.body;
  const passwordToValidate = newPassword || password;

  // 如果没有密码字段，跳过验证（可能是其他操作）
  if (!passwordToValidate) {
    return next();
  }

  const validation = validatePassword(passwordToValidate);
  
  if (!validation.isValid) {
    return res.status(400).json({
      code: 400,
      message: '密码不符合安全要求',
      errors: validation.errors
    });
  }

  // 将强度信息附加到请求对象，供后续使用
  req.passwordStrength = validation.strength;
  next();
}

/**
 * 获取密码策略配置（供前端使用）
 */
function getPasswordPolicy() {
  return {
    minLength: PASSWORD_POLICY.minLength,
    maxLength: PASSWORD_POLICY.maxLength,
    requireUppercase: PASSWORD_POLICY.requireUppercase,
    requireLowercase: PASSWORD_POLICY.requireLowercase,
    requireNumber: PASSWORD_POLICY.requireNumber,
    requireSpecial: PASSWORD_POLICY.requireSpecial
  };
}

module.exports = {
  PASSWORD_POLICY,
  validatePassword,
  calculatePasswordStrength,
  validatePasswordMiddleware,
  getPasswordPolicy
};
