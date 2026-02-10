#!/usr/bin/env node

/**
 * PostgreSQL/MySQL 项目数据库创建脚本
 *
 * 功能：
 * - 自动创建新项目的数据库
 * - 授予应用用户访问权限
 * - 支持 PostgreSQL 和 MySQL
 *
 * 使用方法：
 *   node scripts/create-project-database.js <projectId>
 *
 * 环境变量要求：
 *   DB_DIALECT - 数据库类型 (postgres/mysql)
 *   DB_HOST - 数据库主机
 *   DB_ADMIN_USER - 管理员用户（有创建数据库权限）
 *   DB_ADMIN_PASSWORD - 管理员密码
 *   DB_USER - 应用用户
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Client } = require('pg');
const mysql = require('mysql2/promise');

const DB_DIALECT = process.env.DB_DIALECT || 'sqlite';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_ADMIN_USER = process.env.DB_ADMIN_USER || (DB_DIALECT === 'postgres' ? 'postgres' : 'root');
const DB_ADMIN_PASSWORD = process.env.DB_ADMIN_PASSWORD || '';
const DB_USER = process.env.DB_USER;
const DB_PROJECT_PREFIX = process.env.DB_PROJECT_PREFIX || 'project_';

async function createPostgresDatabase(projectId) {
  // 安全性：严格验证输入，防止SQL注入
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) {
    throw new Error(`无效的项目ID格式: ${projectId}，仅允许字母、数字、下划线和连字符`);
  }
  if (DB_USER && !/^[a-zA-Z0-9_]+$/.test(DB_USER)) {
    throw new Error(`无效的DB_USER格式，仅允许字母、数字和下划线`);
  }
  const dbName = `${DB_PROJECT_PREFIX}${projectId}`;

  console.log(`创建 PostgreSQL 数据库: ${dbName}`);

  const client = new Client({
    host: DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: DB_ADMIN_USER,
    password: DB_ADMIN_PASSWORD,
    database: 'postgres' // 连接到默认数据库
  });

  try {
    await client.connect();

    // 检查数据库是否已存在
    const checkResult = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );

    if (checkResult.rows.length > 0) {
      console.log(`✓ 数据库 ${dbName} 已存在`);
      return;
    }

    // 创建数据库
    await client.query(`CREATE DATABASE "${dbName}" OWNER ${DB_USER}`);
    console.log(`✓ 数据库 ${dbName} 创建成功`);

    // 授予权限
    await client.query(`GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO ${DB_USER}`);
    console.log(`✓ 已授予 ${DB_USER} 访问权限`);

  } catch (error) {
    console.error('创建 PostgreSQL 数据库失败:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

async function createMySQLDatabase(projectId) {
  // 安全性：严格验证输入，防止SQL注入
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) {
    throw new Error(`无效的项目ID格式: ${projectId}，仅允许字母、数字、下划线和连字符`);
  }
  const dbName = `${DB_PROJECT_PREFIX}${projectId}`;

  console.log(`创建 MySQL 数据库: ${dbName}`);

  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: DB_ADMIN_USER,
    password: DB_ADMIN_PASSWORD
  });

  try {
    // 检查数据库是否已存在
    const [databases] = await connection.query(
      `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [dbName]
    );

    if (databases.length > 0) {
      console.log(`✓ 数据库 ${dbName} 已存在`);
      return;
    }

    // 创建数据库
    await connection.query(
      `CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`✓ 数据库 ${dbName} 创建成功`);

    // 授予权限
    await connection.query(
      `GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO ?@'%'`,
      [DB_USER]
    );
    await connection.query('FLUSH PRIVILEGES');
    console.log(`✓ 已授予 ${DB_USER} 访问权限`);

  } catch (error) {
    console.error('创建 MySQL 数据库失败:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

async function main() {
  const projectId = process.argv[2];

  if (!projectId) {
    console.error('错误: 请指定项目ID');
    console.log('使用方法: node scripts/create-project-database.js <projectId>');
    process.exit(1);
  }

  if (DB_DIALECT === 'sqlite') {
    console.log('SQLite 模式：数据库文件会自动创建，无需运行此脚本');
    process.exit(0);
  }

  if (!DB_USER) {
    console.error('错误: 未设置 DB_USER 环境变量');
    process.exit(1);
  }

  console.log('=====================================');
  console.log('  项目数据库创建脚本');
  console.log('=====================================');
  console.log(`  数据库类型: ${DB_DIALECT}`);
  console.log(`  项目ID: ${projectId}`);
  console.log(`  数据库名: ${DB_PROJECT_PREFIX}${projectId}`);
  console.log('-------------------------------------');

  try {
    if (DB_DIALECT === 'postgres' || DB_DIALECT === 'postgresql') {
      await createPostgresDatabase(projectId);
    } else if (DB_DIALECT === 'mysql' || DB_DIALECT === 'mariadb') {
      await createMySQLDatabase(projectId);
    } else {
      console.error(`不支持的数据库类型: ${DB_DIALECT}`);
      process.exit(1);
    }

    console.log('=====================================');
    console.log('✓ 项目数据库创建完成');
    console.log('=====================================');

  } catch (error) {
    console.error('操作失败:', error.message);
    process.exit(1);
  }
}

main();
