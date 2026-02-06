// 修复脚本：重新哈希所有明文密码
const bcrypt = require('bcryptjs');
const { PlatformUser } = require('./models');

async function fixPasswords() {
  try {
    console.log('开始修复密码...');

    const users = await PlatformUser.findAll();

    for (const user of users) {
      // 检查密码是否已经是 bcrypt 哈希（bcrypt 哈希总是以 $2a$, $2b$, 或 $2y$ 开头）
      const isBcryptHash = /^\$2[ayb]\$/.test(user.password);

      if (!isBcryptHash) {
        console.log(`用户 ${user.email} 的密码需要重新哈希`);

        // 重新哈希密码
        const hashedPassword = await bcrypt.hash(user.password, 10);

        // 直接更新数据库，跳过钩子
        await user.update({ password: hashedPassword }, {
          hooks: false  // 跳过钩子，避免重复哈希
        });

        console.log(`✓ 已修复用户 ${user.email} 的密码`);
      } else {
        console.log(`✓ 用户 ${user.email} 的密码已正确哈希`);
      }
    }

    console.log('\n所有密码修复完成！');
    process.exit(0);
  } catch (error) {
    console.error('修复密码失败:', error);
    process.exit(1);
  }
}

fixPasswords();
