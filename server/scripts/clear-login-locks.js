/**
 * 清除所有登录锁定记录 - 简化版
 */

const tracker = require('../lib/LoginAttemptTracker');

console.log('🔓 清除登录锁定');
console.log('=' .repeat(60));

// 直接清除所有记录
if (tracker.attempts && typeof tracker.attempts.clear === 'function') {
  const sizeBefore = tracker.attempts.size;
  tracker.attempts.clear();
  console.log(`✅ 成功清除 ${sizeBefore} 条登录锁定记录`);
} else {
  console.log('⚠️  无法访问锁定记录，可能已经清空或使用了 Redis');
}

console.log('\n💡 提示: 现在可以重新登录了');
console.log('=' .repeat(60));

process.exit(0);
