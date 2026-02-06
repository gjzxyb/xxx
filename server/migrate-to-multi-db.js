// 数据迁移脚本：从单一数据库迁移到多数据库架构
const { User, Subject, Selection, Project } = require('./models');
const dbManager = require('./lib/DatabaseManager');

async function migrate() {
  console.log('=== 开始数据迁移 ===\n');

  try {
    // 1. 获取所有项目
    const projects = await Project.findAll();
    console.log(`找到 ${projects.length} 个项目需要迁移\n`);

    for (const project of projects) {
      console.log(`\n处理项目: ${project.name} (${project.id})`);

      // 2. 为每个项目创建独立数据库
      console.log('  ├─ 创建项目数据库...');
      await dbManager.initProjectDb(project.id);

      // 3. 获取项目模型
      const projectModels = await dbManager.getProjectModels(project.id);
      const { User: ProjectUser, Subject: ProjectSubject, Selection: ProjectSelection } = projectModels;

      // 4. 迁移用户数据
      const users = await User.findAll({
        where: { projectId: project.id },
        raw: true
      });
      console.log(`  ├─ 迁移 ${users.length} 个用户...`);

      for (const user of users) {
        const { id, studentId, name, password, className, role, phone } = user;
        await ProjectUser.create({
          id,
          studentId,
          name,
          password,  // 密码已经是哈希过的
          className,
          role,
          phone
        }, { hooks: false });  // 跳过钩子，避免重复哈希
      }

      // 5. 迁移科目数据
      const subjects = await Subject.findAll({
        where: { projectId: project.id },
        raw: true
      });
      console.log(`  ├─ 迁移 ${subjects.length} 个科目...`);

      for (const subject of subjects) {
        const { id, name, category, description, maxCapacity, currentCount, isActive } = subject;
        await ProjectSubject.create({
          id,
          name,
          category,
          description,
          maxCapacity,
          currentCount,
          isActive
        });
      }

      // 6. 迁移选科数据
      const selections = await Selection.findAll({
        where: { projectId: project.id },
        raw: true
      });
      console.log(`  ├─ 迁移 ${selections.length} 条选科记录...`);

      for (const selection of selections) {
        const { id, userId, physicsOrHistory, electiveOne, electiveTwo, status, submittedAt, confirmedAt, remark } = selection;
        await ProjectSelection.create({
          id,
          userId,
          physicsOrHistory,
          electiveOne,
          electiveTwo,
          status,
          submittedAt,
          confirmedAt,
          remark
        });
      }

      console.log(`  └─ ✓ 项目迁移完成`);
    }

    console.log('\n=== 数据迁移完成 ===');
    console.log('\n下一步：');
    console.log('1. 验证迁移数据：运行 node test-multi-db.js');
    console.log('2. 备份旧数据库：重命名 database.sqlite 为 database.sqlite.bak');
    console.log('3. 重启服务器测试新架构');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 迁移失败:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// 执行迁移
migrate();
