#!/usr/bin/env node

/**
 * 数据库切换功能测试脚本
 * 
 * 测试内容：
 * 1. SQLite 配置加载
 * 2. PostgreSQL 配置加载（模拟）
 * 3. MySQL 配置加载（模拟）
 * 4. 生产环境密码验证
 */

const path = require('path');

console.log('========================================');
console.log('  数据库切换功能测试');
console.log('========================================\n');

// 测试 1: SQLite 配置
console.log('测试 1: SQLite 配置加载');
console.log('-------------------------------------');
process.env.DB_DIALECT = 'sqlite';
process.env.NODE_ENV = 'development';
delete require.cache[require.resolve('../server/config/database.js')];

try {
  const db = require('../server/config/database.js');
  console.log('✓ SQLite 配置加载成功');
  console.log('  Dialect:', db.options.dialect);
  console.log('  Storage:', db.options.storage);
} catch (err) {
  console.error('✗ SQLite 配置加载失败:', err.message);
}

console.log('');

// 测试 2: PostgreSQL 配置（开发环境）
console.log('测试 2: PostgreSQL 配置加载（开发环境）');
console.log('-------------------------------------');
process.env.DB_DIALECT = 'postgres';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'test_db';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = ''; // 开发环境允许空密码
process.env.NODE_ENV = 'development';
delete require.cache[require.resolve('../server/config/database.js')];

try {
  const db = require('../server/config/database.js');
  console.log('✓ PostgreSQL 配置加载成功');
  console.log('  Dialect:', db.options.dialect);
  console.log('  Host:', db.options.host);
  console.log('  Database:', db.options.database);
  console.log('  Pool Max:', db.options.pool?.max);
  console.log('  Pool Min:', db.options.pool?.min);
} catch (err) {
  console.error('✗ PostgreSQL 配置加载失败:', err.message);
}

console.log('');

// 测试 3: PostgreSQL 配置（生产环境，无密码）
console.log('测试 3: PostgreSQL 生产环境密码验证');
console.log('-------------------------------------');
process.env.DB_DIALECT = 'postgres';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'test_db';
process.env.DB_USER = 'test_user';
delete process.env.DB_PASSWORD; // 不设置密码
process.env.NODE_ENV = 'production';
delete require.cache[require.resolve('../server/config/database.js')];

try {
  const db = require('../server/config/database.js');
  console.error('✗ 应该抛出密码错误，但配置加载成功了');
} catch (err) {
  if (err.message.includes('DB_PASSWORD')) {
    console.log('✓ 生产环境密码验证正常工作');
    console.log('  错误信息:', err.message);
  } else {
    console.error('✗ 意外的错误:', err.message);
  }
}

console.log('');

// 测试 4: PostgreSQL 配置（生产环境，有密码）
console.log('测试 4: PostgreSQL 生产环境（正确配置）');
console.log('-------------------------------------');
process.env.DB_DIALECT = 'postgres';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'test_db';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'secure_password';
process.env.DB_POOL_MAX = '100';
process.env.DB_POOL_MIN = '10';
process.env.NODE_ENV = 'production';
delete require.cache[require.resolve('../server/config/database.js')];

try {
  const db = require('../server/config/database.js');
  console.log('✓ PostgreSQL 生产环境配置加载成功');
  console.log('  Dialect:', db.options.dialect);
  console.log('  Host:', db.options.host);
  console.log('  Pool Max:', db.options.pool?.max);
  console.log('  Pool Min:', db.options.pool?.min);
} catch (err) {
  console.error('✗ PostgreSQL 生产环境配置加载失败:', err.message);
}

console.log('');

// 测试 5: MySQL 配置
console.log('测试 5: MySQL 配置加载');
console.log('-------------------------------------');
process.env.DB_DIALECT = 'mysql';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'test_db';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'secure_password';
process.env.NODE_ENV = 'production';
delete require.cache[require.resolve('../server/config/database.js')];

try {
  const db = require('../server/config/database.js');
  console.log('✓ MySQL 配置加载成功');
  console.log('  Dialect:', db.options.dialect);
  console.log('  Host:', db.options.host);
  console.log('  Charset:', db.options.dialectOptions?.charset);
  console.log('  Pool Max:', db.options.pool?.max);
} catch (err) {
  console.error('✗ MySQL 配置加载失败:', err.message);
}

console.log('');

// 测试 6: 平台服务器数据库配置
console.log('测试 6: 平台服务器数据库配置');
console.log('-------------------------------------');
process.env.DB_DIALECT = 'sqlite';
process.env.NODE_ENV = 'development';
delete require.cache[require.resolve('../platform/server/config/database.js')];

try {
  const { platformDb, getProjectDb, closeProjectDb, closeAllConnections } = require('../platform/server/config/database.js');
  console.log('✓ 平台数据库配置加载成功');
  console.log('  导出函数检查:');
  console.log('    - platformDb:', platformDb ? '✓' : '✗');
  console.log('    - getProjectDb:', typeof getProjectDb === 'function' ? '✓' : '✗');
  console.log('    - closeProjectDb:', typeof closeProjectDb === 'function' ? '✓' : '✗');
  console.log('    - closeAllConnections:', typeof closeAllConnections === 'function' ? '✓' : '✗');
} catch (err) {
  console.error('✗ 平台数据库配置加载失败:', err.message);
}

console.log('');
console.log('========================================');
console.log('✓ 数据库切换功能测试完成');
console.log('========================================');

// 清理环境变量
process.env.DB_DIALECT = 'sqlite';
process.env.NODE_ENV = 'development';
