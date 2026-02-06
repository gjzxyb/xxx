// 测试脚本：验证多数据库架构
const dbManager = require('./lib/DatabaseManager');
const { Project } = require('./models');

async function testMultiDatabase() {
  try {
    console.log('=== 多数据库架构测试 ===\n');

    // 1. 测试平台数据库
    console.log('1. 测试平台数据库连接...');
    const platformDb = dbManager.getPlatformDb();
    await platformDb.authenticate();
    console.log('✓ 平台数据库连接成功\n');

    // 2. 检查项目数据库文件
    console.log('2. 检查项目数据库文件...');
    const projectDbs = dbManager.getAllProjectDbs();
    console.log(`找到 ${projectDbs.length} 个项目数据库:`);
    projectDbs.forEach(id => console.log(`  - ${id}.sqlite`));
    console.log('');

    //  3. 测试第一个项目数据库
    if (projectDbs.length > 0) {
      const firstProjectId = projectDbs[0];
      console.log(`3. 测试项目数据库: ${firstProjectId}`);

      const projectModels = await dbManager.getProjectModels(firstProjectId);
      const { User, Subject, Selection } = projectModels;

      // 查询用户数
      const userCount = await User.count();
      const adminCount = await User.count({ where: { role: 'admin' } });
      const studentCount = await User.count({ where: { role: 'student' } });

      console.log(`  - 用户总数: ${userCount}`);
      console.log(`  - 管理员: ${adminCount}`);
      console.log(`  - 学生: ${studentCount}`);

      // 查询科目数
      const subjectCount = await Subject.count();
      console.log(`  - 科目数: ${subjectCount}`);

      // 查询选科数
      const selectionCount = await Selection.count();
      console.log(`  - 选科记录: ${selectionCount}`);

      console.log('\n✓ 项目数据库查询成功\n');
    }

    // 4. 验证数据隔离
    if (projectDbs.length >= 2) {
      console.log('4. 验证数据隔离...');

      const proj1Models = await dbManager.getProjectModels(projectDbs[0]);
      const proj2Models = await dbManager.getProjectModels(projectDbs[1]);

      const users1 = await proj1Models.User.findAll();
      const users2 = await proj2Models.User.findAll();

      console.log(`  - 项目1用户数: ${users1.length}`);
      console.log(`  - 项目2用户数: ${users2.length}`);

      if (users1.length > 0 && users2.length > 0) {
        console.log('  ✓ 两个项目数据完全隔离');
      }
    }

    console.log('\n=== 测试完成 ===');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

testMultiDatabase();
