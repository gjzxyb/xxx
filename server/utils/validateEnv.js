/**
 * 环境变量验证工具
 * 在应用启动时统一验证所有必需的环境变量
 */

// ANSI 颜色代码（替代 chalk）
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

// 颜色辅助函数
const colorize = (text, color) => `${colors[color]}${text}${colors.reset}`;
const red = (text) => colorize(text, 'red');
const green = (text) => colorize(text, 'green');
const yellow = (text) => colorize(text, 'yellow');
const cyan = (text) => colorize(text, 'cyan');
const gray = (text) => colorize(text, 'gray');
const bold = (text) => colorize(text, 'bright');

/**
 * 必需的环境变量配置
 */
const REQUIRED_ENV_VARS = [
  {
    name: 'JWT_SECRET',
    description: 'JWT密钥，用于token签名',
    validator: (value) => value && value.length >= 32,
    errorMsg: 'JWT_SECRET必须至少32个字符'
  },
  {
    name: 'DB_HOST',
    description: '数据库主机地址',
    validator: (value) => value && value.length > 0,
    errorMsg: 'DB_HOST不能为空'
  },
  {
    name: 'DB_USER',
    description: '数据库用户名',
    validator: (value) => value && value.length > 0,
    errorMsg: 'DB_USER不能为空'
  },
  {
    name: 'DB_PASSWORD',
    description: '数据库密码',
    validator: (value) => value !== undefined, // 允许空密码，但必须存在
    errorMsg: 'DB_PASSWORD必须设置（可以为空字符串）'
  },
  {
    name: 'DB_NAME',
    description: '数据库名称',
    validator: (value) => value && value.length > 0,
    errorMsg: 'DB_NAME不能为空'
  }
];

/**
 * 可选但建议配置的环境变量
 */
const RECOMMENDED_ENV_VARS = [
  {
    name: 'NODE_ENV',
    description: '运行环境',
    default: 'development',
    validator: (value) => ['development', 'production', 'test'].includes(value),
    warningMsg: 'NODE_ENV应该是 development, production 或 test'
  },
  {
    name: 'PORT',
    description: '服务器端口',
    default: '3000',
    validator: (value) => !isNaN(parseInt(value)) && parseInt(value) > 0 && parseInt(value) < 65536,
    warningMsg: 'PORT必须是1-65535之间的有效端口号'
  },
  {
    name: 'JWT_ACCESS_EXPIRY',
    description: 'JWT访问令牌过期时间',
    default: '2h'
  },
  {
    name: 'JWT_REFRESH_EXPIRY',
    description: 'JWT刷新令牌过期时间',
    default: '7d'
  },
  {
    name: 'RATE_LIMIT_MAX',
    description: '速率限制最大请求数',
    default: '100',
    validator: (value) => !isNaN(parseInt(value)) && parseInt(value) > 0,
    warningMsg: 'RATE_LIMIT_MAX必须是正整数'
  },
  {
    name: 'RATE_LIMIT_WINDOW_MS',
    description: '速率限制时间窗口（毫秒）',
    default: '900000',
    validator: (value) => !isNaN(parseInt(value)) && parseInt(value) > 0,
    warningMsg: 'RATE_LIMIT_WINDOW_MS必须是正整数'
  }
];

/**
 * 验证环境变量
 * @returns {boolean} 验证是否通过
 */
function validateEnv() {
  console.log(cyan('\n🔍 验证环境变量配置...\n'));

  let hasErrors = false;
  let hasWarnings = false;

  // 验证必需的环境变量
  console.log(bold('必需的环境变量:'));
  for (const config of REQUIRED_ENV_VARS) {
    const value = process.env[config.name];
    const isValid = config.validator(value);

    if (!isValid) {
      console.log(red(`  ✗ ${config.name}: ${config.errorMsg}`));
      console.log(gray(`    说明: ${config.description}`));
      hasErrors = true;
    } else {
      const displayValue = config.name.includes('PASSWORD') || config.name.includes('SECRET')
        ? '***'
        : value;
      console.log(green(`  ✓ ${config.name}: ${displayValue}`));
    }
  }

  // 验证推荐的环境变量
  console.log(bold('\n推荐的环境变量:'));
  for (const config of RECOMMENDED_ENV_VARS) {
    const value = process.env[config.name];

    if (!value) {
      console.log(yellow(`  ⚠ ${config.name}: 未设置，使用默认值 "${config.default}"`));
      console.log(gray(`    说明: ${config.description}`));
      hasWarnings = true;
      // 设置默认值
      if (config.default) {
        process.env[config.name] = config.default;
      }
    } else if (config.validator && !config.validator(value)) {
      console.log(yellow(`  ⚠ ${config.name}: ${config.warningMsg}`));
      console.log(gray(`    当前值: ${value}`));
      hasWarnings = true;
    } else {
      console.log(green(`  ✓ ${config.name}: ${value}`));
    }
  }

  console.log('');

  // 如果有错误，退出程序
  if (hasErrors) {
    console.log(red('❌ 环境变量验证失败！'));
    console.log(yellow('请检查 .env 文件并设置所有必需的环境变量。'));
    console.log(yellow('参考 .env.example 文件查看配置示例。\n'));
    return false;
  }

  // 显示警告但继续运行
  if (hasWarnings) {
    console.log(yellow('⚠️  环境变量验证通过，但有一些警告'));
    console.log(yellow('建议检查并配置上述警告项以获得最佳性能。\n'));
  } else {
    console.log(green('✅ 环境变量验证通过！\n'));
  }

  return true;
}

/**
 * 生产环境额外验证
 */
function validateProductionEnv() {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  console.log(cyan('🔒 生产环境额外安全检查...\n'));

  let hasErrors = false;

  // JWT_SECRET 必须足够强
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret.length < 64) {
    console.log(red('  ✗ 生产环境 JWT_SECRET 应至少64个字符'));
    hasErrors = true;
  }

  // 不应该使用默认值
  const dangerousDefaults = ['secret', 'password', '123456', 'admin'];
  if (dangerousDefaults.some(d => jwtSecret.toLowerCase().includes(d))) {
    console.log(red('  ✗ JWT_SECRET 包含常见弱密钥，请使用强随机密钥'));
    hasErrors = true;
  }

  if (hasErrors) {
    console.log(red('\n❌ 生产环境安全检查失败！\n'));
    return false;
  }

  console.log(green('✅ 生产环境安全检查通过！\n'));
  return true;
}

module.exports = {
  validateEnv,
  validateProductionEnv
};
