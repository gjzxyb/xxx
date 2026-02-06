// 修复脚本：删除旧的 unique constraint
const sequelize = require('./config/database');

async function fixUniqueConstraint() {
  try {
    console.log('=== 修复 users 表的 unique constraint ===\n');

    // SQLite 不支持直接 DROP INDEX sqlite_autoindex，需要重建表
    console.log('步骤 1: 创建临时表...');
    await sequelize.query(`
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        studentId VARCHAR(20) NOT NULL,
        name VARCHAR(50) NOT NULL,
        password VARCHAR(100) NOT NULL,
        className VARCHAR(50),
        role TEXT CHECK(role IN ('student', 'admin')) DEFAULT 'student',
        phone VARCHAR(20),
        project_id VARCHAR(255),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('步骤 2: 复制数据到新表...');
    await sequelize.query(`
      INSERT INTO users_new
      SELECT id, studentId, name, password, className, role, phone, project_id, createdAt, updatedAt
      FROM users
    `);

    console.log('步骤 3: 删除旧表...');
    await sequelize.query(`DROP TABLE users`);

    console.log('步骤 4: 重命名新表...');
    await sequelize.query(`ALTER TABLE users_new RENAME TO users`);

    console.log('步骤 5: 创建复合唯一索引...');
    await sequelize.query(`
      CREATE UNIQUE INDEX unique_student_per_project
      ON users (studentId, project_id)
    `);

    console.log('\n✅ 修复完成！现在不同项目可以使用相同的管理员用户名了。\n');

    // 验证
    console.log('验证索引:');
    const [results] = await sequelize.query(`
      SELECT name, sql
      FROM sqlite_master
      WHERE type='index' AND tbl_name='users'
    `);

    results.forEach(index => {
      console.log(`- ${index.name}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('修复失败:', error);
    process.exit(1);
  }
}

fixUniqueConstraint();
