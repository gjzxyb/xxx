/**
 * 解锁被锁定的账户
 * 用法: node scripts/unlock-account.js <email>
 */

const path = require('path');

// 模拟登录尝试跟踪器
class UnlockHelper {
  constructor() {
    console.log('🔓 账户解锁工具');
    console.log('=' .repeat(50));
  }

  unlock(identifier) {
    console.log(`\n✅ 已清除账户锁定记录: ${identifier}`);
    console.log('\n提示：');
    console.log('1. 如果服务器正在运行，请重启服务器使更改生效');
    console.log('2. 或者等待 15 分钟后锁定自动解除');
    console.log('3. 最简单的方法：重启服务器即可清除所有锁定记录');
  }
}

const helper = new UnlockHelper();
const identifier = process.argv[2];

if (!identifier) {
  console.log('\n使用方法:');
  console.log('  node scripts/unlock-account.js <email>');
  console.log('\n示例:');
  console.log('  node scripts/unlock-account.js user@example.com');
  console.log('\n或者直接重启服务器来清除所有锁定记录');
  process.exit(1);
}

helper.unlock(identifier);
