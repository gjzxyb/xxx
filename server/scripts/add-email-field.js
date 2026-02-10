/**
 * 数据库迁移脚本：为现有项目数据库添加 email 字段
 * 同时将 email 格式的 studentId 自动填充到 email 字段
 */

const path = require('path');
const fs = require('fs');
const { Sequelize, DataTypes } = require('sequelize');

const dbManager = require('../lib/DatabaseManager');

// 邮箱格式正则表达式
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 为单个项目数据库添加 email 字段
 */
async function migrateProjectDb(projectId) {
  console.log(`\n开始迁移项目数据库: ${projectId}`);

  try {
    // 获取数据库连接
    const sequelize = await dbManager.getProjectDb(projectId);
    const queryInterface = sequelize.getQueryInterface();

    // 检查 email 字段是否已存在
    const tableDescription = await queryInterface.describeTable('users');

    if (tableDescription.email) {
      console.log(`  ✓ email 字段已存在，跳过迁移`);

      // 但仍然需要填充 email 字段（如果 studentId 是 email 格式）
      await fillEmailFromStudentId(sequelize);
      return { success: true, skipped: true };
    }

    // 添加 email 字段
    await queryInterface.addColumn('users', 'email', {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '邮箱地址'
    });

    console.log(`  ✓ 成功添加 email 字段`);

    // 填充 email 字段（如果 studentId 是 email 格式）
    await fillEmailFromStudentId(sequelize);

    return { success: true, skipped: false };
  } catch (error) {
    console.error(`  ✗ 迁移失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 将 email 格式的 studentId 填充到 email 字段
 */
async function fillEmailFromStudentId(sequelize) {
  try {
    // 查询所有用户
    const [users] = await sequelize.query('SELECT id, studentId, email FROM users');

    let updatedCount = 0;

    for (const user of users) {
      // 如果 studentId 是 email 格式，且 email 字段为空
      if (emailRegex.test(user.studentId) && !user.email) {
        await sequelize.query(
          'UPDATE users SET email = ? WHERE id = ?',
          { replacements: [user.studentId, user.id] }
        );
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      console.log(`  ✓ 自动填充了 ${updatedCount} 个用户的 email 字段`);
    }
  } catch (error) {
    console.error(`  ⚠ 填充 email 字段失败: ${error.message}`);
  }
}

/**
 * 迁移所有项目数据库
 */
async function migrateAllProjects() {
  console.log('========================================');
  console.log('  数据库迁移: 添加 email 字段');
  console.log('========================================\n');

  const projectIds = dbManager.getAllProjectDbs();

  if (projectIds.length === 0) {
    console.log('未找到任何项目数据库');
    return;
  }

  console.log(`找到 ${projectIds.length} 个项目数据库\n`);

  const results = {
    total: projectIds.length,
    success: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  for (const projectId of projectIds) {
    const result = await migrateProjectDb(projectId);

    if (result.success) {
      results.success++;
      if (result.skipped) {
        results.skipped++;
      }
    } else {
      results.failed++;
      results.errors.push({ projectId, error: result.error });
    }
  }

  // 输出总结
  console.log('\n========================================');
  console.log('  迁移完成');
  console.log('========================================');
  console.log(`总计: ${results.total} 个项目`);
  console.log(`成功: ${results.success} 个 (其中 ${results.skipped} 个已存在)`);
  console.log(`失败: ${results.failed} 个`);

  if (results.errors.length > 0) {
    console.log('\n失败的项目:');
    results.errors.forEach(({ projectId, error }) => {
      console.log(`  - ${projectId}: ${error}`);
    });
  }

  // 关闭所有连接
  await dbManager.closeAll();
}

/**
 * 迁移指定项目数据库（可选参数）
 */
async function main() {
  try {
    const projectId = process.argv[2];

    if (projectId) {
      // 迁移单个项目
      console.log(`迁移指定项目: ${projectId}`);
      await migrateProjectDb(projectId);
      await dbManager.closeAll();
    } else {
      // 迁移所有项目
      await migrateAllProjects();
    }

    console.log('\n✓ 迁移脚本执行完毕\n');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ 迁移脚本执行失败:', error);
    process.exit(1);
  }
}

// 运行脚本
main();
