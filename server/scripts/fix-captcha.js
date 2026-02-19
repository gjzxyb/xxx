/**
 * 验证码功能诊断和修复脚本
 * 运行: node scripts/fix-captcha.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { sequelize, SystemConfig } = require('../models');

async function diagnoseCaptcha() {
  console.log('🔍 开始诊断验证码功能...\n');

  try {
    // 1. 检查数据库连接
    console.log('1️⃣ 检查数据库连接...');
    await sequelize.authenticate();
    console.log('   ✅ 数据库连接正常\n');

    // 2. 检查 SystemConfig 表
    console.log('2️⃣ 检查 SystemConfig 表...');
    const configCount = await SystemConfig.count();
    console.log(`   ✅ SystemConfig 表存在，共 ${configCount} 条配置\n`);

    // 3. 检查验证码配置
    console.log('3️⃣ 检查验证码配置...');
    const captchaConfig = await SystemConfig.findOne({
      where: { key: 'captcha_enabled' }
    });

    if (!captchaConfig) {
      console.log('   ⚠️  验证码配置不存在，正在创建...');
      await SystemConfig.create({
        key: 'captcha_enabled',
        value: 'false',
        projectId: null,
        description: '验证码开关'
      });
      console.log('   ✅ 验证码配置已创建（默认关闭）\n');
    } else {
      console.log(`   ✅ 验证码配置存在`);
      console.log(`   📝 当前状态: ${captchaConfig.value === 'true' ? '开启' : '关闭'}`);
      console.log(`   📝 描述: ${captchaConfig.description || '无'}\n`);
    }

    // 4. 列出所有平台配置
    console.log('4️⃣ 所有平台配置:');
    const allConfigs = await SystemConfig.findAll({
      where: { projectId: null },
      order: [['key', 'ASC']]
    });

    allConfigs.forEach(config => {
      console.log(`   - ${config.key}: ${config.value} (${config.description || '无描述'})`);
    });
    console.log('');

    // 5. 提供修复选项
    console.log('5️⃣ 修复选项:');
    console.log('   如需开启验证码，请运行:');
    console.log('   node scripts/fix-captcha.js --enable\n');
    console.log('   如需关闭验证码，请运行:');
    console.log('   node scripts/fix-captcha.js --disable\n');

  } catch (error) {
    console.error('❌ 诊断失败:', error);
    process.exit(1);
  }
}

async function enableCaptcha() {
  console.log('🔧 正在开启验证码功能...\n');

  try {
    await sequelize.authenticate();

    const result = await SystemConfig.setValue(
      'captcha_enabled',
      'true',
      null,
      '验证码开关'
    );

    console.log('✅ 验证码功能已开启！\n');
    console.log('📝 验证步骤:');
    console.log('   1. 访问注册页面');
    console.log('   2. 检查是否显示验证码输入框');
    console.log('   3. 尝试注册，验证码应该生效\n');

  } catch (error) {
    console.error('❌ 开启失败:', error);
    process.exit(1);
  }
}

async function disableCaptcha() {
  console.log('🔧 正在关闭验证码功能...\n');

  try {
    await sequelize.authenticate();

    await SystemConfig.setValue(
      'captcha_enabled',
      'false',
      null,
      '验证码开关'
    );

    console.log('✅ 验证码功能已关闭！\n');

  } catch (error) {
    console.error('❌ 关闭失败:', error);
    process.exit(1);
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--enable')) {
    await enableCaptcha();
  } else if (args.includes('--disable')) {
    await disableCaptcha();
  } else {
    await diagnoseCaptcha();
  }

  await sequelize.close();
  process.exit(0);
}

main();
