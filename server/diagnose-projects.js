// 诊断脚本：检查项目和用户的关联关系
const { PlatformUser, Project } = require('./models');

async function diagnose() {
  try {
    console.log('=== 平台用户 ===');
    const users = await PlatformUser.findAll({
      attributes: ['id', 'email', 'name']
    });

    for (const user of users) {
      const projectCount = await Project.count({ where: { ownerId: user.id } });
      console.log(`用户 ID: ${user.id}, Email: ${user.email}, 项目数: ${projectCount}`);

      // 显示该用户的所有项目
      const projects = await Project.findAll({
        where: { ownerId: user.id },
        attributes: ['id', 'name', 'ownerId']
      });
      projects.forEach(p => {
        console.log(`  - 项目: ${p.name} (ID: ${p.id}, ownerId: ${p.ownerId})`);
      });
    }

    console.log('\n=== 所有项目 ===');
    const allProjects = await Project.findAll({
      attributes: ['id', 'name', 'ownerId']
    });
    allProjects.forEach(p => {
      console.log(`项目: ${p.name}, ownerId: ${p.ownerId}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('诊断失败:', error);
    process.exit(1);
  }
}

diagnose();
