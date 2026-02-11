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
    console.error('密码验证失败:', {
      password: '***',
      errors: validation.errors
    });
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
 * 密码策略配置和验证
 * 安全性：增强密码强度要求，防止弱密码和默认密码
 */

// 禁止使用的常见弱密码
const FORBIDDEN_PASSWORDS = [
  '123456', '12345678', '123456789', '1234567890',
  'password', 'password123', 'password1', 'password!',
  'qwerty', 'qwertyuiop', 'qwerty123',
  'abc123', 'abc123456',
  'admin', 'admin123', 'administrator',
  'welcome', 'welcome123',
  'letmein', 'monkey', 'dragon',
  '111111', '000000', '123123',
  'sunshine', 'iloveyou', 'princess',
  'password1234', 'test123', 'user123'
];

/**
 * 密码策略配置
 */
const passwordPolicy = {
  minLength: 8,
  maxLength: 32,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false, // 可选：特殊字符
  forbidCommonPasswords: true,
  forbidStudentIdAsPassword: true, // 禁止使用学号作为密码
  forbidUsernameInPassword: true   // 禁止密码包含用户名
};

/**
 * 验证密码强度
 * @param {string} password - 待验证的密码
 * @param {Object} context - 上下文信息（studentId, username等）
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validatePasswordStrength(password, context = {}) {
  const errors = [];

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['密码不能为空'] };
  }

  // 1. 长度检查
  if (password.length < passwordPolicy.minLength) {
    errors.push(`密码长度至少${passwordPolicy.minLength}位`);
  }
  if (password.length > passwordPolicy.maxLength) {
    errors.push(`密码长度不能超过${passwordPolicy.maxLength}位`);
  }

  // 2. 复杂度检查
  if (passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('密码必须包含至少一个大写字母');
  }
  if (passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('密码必须包含至少一个小写字母');
  }
  if (passwordPolicy.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('密码必须包含至少一个数字');
  }
  if (passwordPolicy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('密码必须包含至少一个特殊字符');
  }

  // 3. 禁止常见弱密码
  if (passwordPolicy.forbidCommonPasswords) {
    const lowerPassword = password.toLowerCase();
    if (FORBIDDEN_PASSWORDS.includes(lowerPassword)) {
      errors.push('密码过于简单，请使用更复杂的密码');
    }

    // 检查是否包含禁用词
    for (const forbidden of FORBIDDEN_PASSWORDS.slice(0, 10)) {
      if (lowerPassword.includes(forbidden)) {
        errors.push(`密码不能包含常见词汇（如"${forbidden}"）`);
        break;
      }
    }
  }

  // 4. 禁止使用学号作为密码
  if (passwordPolicy.forbidStudentIdAsPassword && context.studentId) {
    if (password === context.studentId || password.toLowerCase() === context.studentId.toLowerCase()) {
      errors.push('密码不能与学号相同');
    }
    // 禁止学号的简单变形
    if (password.includes(context.studentId)) {
      errors.push('密码不能包含学号');
    }
  }

  // 5. 禁止密码包含用户名
  if (passwordPolicy.forbidUsernameInPassword && context.username) {
    const username = context.username.toLowerCase();
    const lowerPassword = password.toLowerCase();
    if (lowerPassword.includes(username) || username.includes(lowerPassword)) {
      errors.push('密码不能包含用户名');
    }
  }

  // 6. 检查连续字符
  if (hasConsecutiveChars(password, 4)) {
    errors.push('密码不能包含4个及以上连续字符（如1234、abcd）');
  }

  // 7. 检查重复字符
  if (hasRepeatingChars(password, 4)) {
    errors.push('密码不能包含4个及以上重复字符（如aaaa、1111）');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 检查是否包含连续字符
 */
function hasConsecutiveChars(str, count) {
  for (let i = 0; i <= str.length - count; i++) {
    let isConsecutive = true;
    for (let j = 1; j < count; j++) {
      if (str.charCodeAt(i + j) !== str.charCodeAt(i + j - 1) + 1) {
        isConsecutive = false;
        break;
      }
    }
    if (isConsecutive) return true;
  }
  return false;
}

/**
 * 检查是否包含重复字符
 */
function hasRepeatingChars(str, count) {
  for (let i = 0; i <= str.length - count; i++) {
    const char = str[i];
    let isRepeating = true;
    for (let j = 1; j < count; j++) {
      if (str[i + j] !== char) {
        isRepeating = false;
        break;
      }
    }
    if (isRepeating) return true;
  }
  return false;
}

/**
 * 获取密码策略配置（供前端显示）
 */
function getPasswordPolicy() {
  return {
    minLength: passwordPolicy.minLength,
    maxLength: passwordPolicy.maxLength,
    requireUppercase: passwordPolicy.requireUppercase,
    requireLowercase: passwordPolicy.requireLowercase,
    requireNumbers: passwordPolicy.requireNumbers,
    requireSpecialChars: passwordPolicy.requireSpecialChars
  };
}

module.exports = {
  validatePasswordStrength,
  validatePasswordMiddleware,
  getPasswordPolicy,
  passwordPolicy,
  FORBIDDEN_PASSWORDS
};
