// 诊断脚本：检查数据库索引
const { User } = require('./models');
const sequelize = require('./config/database');

async function checkIndexes() {
  try {
    console.log('=== 检查 users 表的索引 ===\n');

    // 获取表的索引信息
    const [results] = await sequelize.query(`
      SELECT name, sql
      FROM sqlite_master
      WHERE type='index' AND tbl_name='users'
    `);

    console.log('当前索引:');
    results.forEach(index => {
      console.log(`\n索引名: ${index.name}`);
      console.log(`SQL: ${index.sql || '(系统自动创建)'}`);
    });

    console.log('\n=== 检查现有 admin 用户 ===\n');
    const admins = await User.findAll({
      where: { role: 'admin' },
      attributes: ['id', 'studentId', 'projectId', 'name']
    });

    console.log(`找到 ${admins.length} 个管理员用户:`);
    admins.forEach(admin => {
      console.log(`- studentId: ${admin.studentId}, projectId: ${admin.projectId}, name: ${admin.name}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('检查失败:', error);
    process.exit(1);
  }
}

checkIndexes();
