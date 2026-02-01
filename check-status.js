// Check project status in database
const { sequelize, Project } = require('./server/models');

async function checkProjects() {
  try {
    const projects = await Project.findAll({
      attributes: ['id', 'name', 'status', 'port', 'ownerId'],
      raw: true
    });

    console.log('\n项目状态数据:');
    console.log('=====================================');
    projects.forEach(p => {
      console.log(`\n项目: ${p.name}`);
      console.log(`  ID: ${p.id}`);
      console.log(`  Status: "${p.status}"`);
      console.log(`  Port: ${p.port}`);
      console.log(`  Owner: ${p.ownerId}`);
    });
    console.log('\n=====================================\n');

    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

checkProjects();
