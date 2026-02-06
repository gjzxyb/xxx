const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

/**
 * 数据库连接管理器
 * 负责管理平台数据库和各项目数据库的连接
 */
class DatabaseManager {
  constructor() {
    this.platformDb = null;
    this.projectConnections = new Map(); // projectId -> Sequelize instance
    this.projectModels = new Map(); // projectId -> models object
    this.connectionLimit = 10; // 最大同时打开的项目数据库连接数
    this.dbDir = path.join(__dirname, '..', 'databases');
    this.projectDbDir = path.join(this.dbDir, 'projects');

    // 确保目录存在
    this.ensureDirectories();
  }

  /**
   * 确保数据库目录存在
   */
  ensureDirectories() {
    if (!fs.existsSync(this.dbDir)) {
      fs.mkdirSync(this.dbDir, { recursive: true });
    }
    if (!fs.existsSync(this.projectDbDir)) {
      fs.mkdirSync(this.projectDbDir, { recursive: true });
    }
  }

  /**
   * 获取平台数据库连接
   * @returns {Sequelize}
   */
  getPlatformDb() {
    if (!this.platformDb) {
      const dbPath = path.join(this.dbDir, 'platform.sqlite');

      this.platformDb = new Sequelize({
        dialect: 'sqlite',
        storage: dbPath,
        logging: false, // 生产环境关闭日志
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000
        }
      });

      console.log(`✓ 平台数据库已连接: ${dbPath}`);
    }

    return this.platformDb;
  }

  /**
   * 获取项目数据库连接（带缓存）
   * @param {string} projectId - 项目ID
   * @returns {Promise<Sequelize>}
   */
  async getProjectDb(projectId) {
    if (!projectId) {
      throw new Error('projectId 不能为空');
    }

    // 检查缓存
    if (this.projectConnections.has(projectId)) {
      return this.projectConnections.get(projectId);
    }

    // 检查连接数限制
    if (this.projectConnections.size >= this.connectionLimit) {
      // LRU: 移除最旧的连接
      const oldestProjectId = this.projectConnections.keys().next().value;
      await this.closeProjectDb(oldestProjectId);
    }

    // 创建新连接
    const dbPath = this.getProjectDbPath(projectId);

    if (!fs.existsSync(dbPath)) {
      throw new Error(`项目数据库不存在: ${projectId}`);
    }

    const sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: dbPath,
      logging: false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    });

    // 测试连接
    await sequelize.authenticate();

    // 缓存连接
    this.projectConnections.set(projectId, sequelize);

    console.log(`✓ 项目数据库已连接: ${projectId}`);

    return sequelize;
  }

  /**
   * 初始化新项目数据库
   * @param {string} projectId - 项目ID
   * @returns {Promise<Sequelize>}
   */
  async initProjectDb(projectId) {
    const dbPath = this.getProjectDbPath(projectId);

    // 如果数据库已存在，先删除
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log(`已删除旧的项目数据库: ${projectId}`);
    }

    // 创建新数据库连接
    const sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: dbPath,
      logging: false
    });

    // 加载项目模型
    const models = this.loadProjectModels(sequelize);

    // 同步数据库结构
    await sequelize.sync({ force: true });

    console.log(`✓ 项目数据库已初始化: ${projectId}`);

    // 缓存连接和模型
    this.projectConnections.set(projectId, sequelize);
    this.projectModels.set(projectId, models);

    return sequelize;
  }

  /**
   * 加载项目模型
   * @param {Sequelize} sequelize - Sequelize 实例
   * @returns {Object} - 模型对象
   */
  loadProjectModels(sequelize) {
    // 加载项目级模型
    const User = require('../models/project/User')(sequelize);
    const Subject = require('../models/project/Subject')(sequelize);
    const Selection = require('../models/project/Selection')(sequelize);

    // 设置关联关系
    Selection.belongsTo(User, { foreignKey: 'userId', as: 'user' });
    Selection.belongsTo(Subject, { foreignKey: 'physicsOrHistory', as: 'physicsHistorySubject' });
    Selection.belongsTo(Subject, { foreignKey: 'electiveOne', as: 'electiveOneSubject' });
    Selection.belongsTo(Subject, { foreignKey: 'electiveTwo', as: 'electiveTwoSubject' });

    User.hasOne(Selection, { foreignKey: 'userId', as: 'selection' });

    return {
      User,
      Subject,
      Selection,
      sequelize
    };
  }

  /**
   * 获取项目模型
   * @param {string} projectId - 项目ID
   * @returns {Promise<Object>} - 模型对象
   */
  async getProjectModels(projectId) {
    // 检查缓存
    if (this.projectModels.has(projectId)) {
      return this.projectModels.get(projectId);
    }

    // 获取数据库连接
    const sequelize = await this.getProjectDb(projectId);

    // 加载模型
    const models = this.loadProjectModels(sequelize);
    this.projectModels.set(projectId, models);

    return models;
  }

  /**
   * 关闭项目数据库连接
   * @param {string} projectId - 项目ID
   */
  async closeProjectDb(projectId) {
    const sequelize = this.projectConnections.get(projectId);

    if (sequelize) {
      await sequelize.close();
      this.projectConnections.delete(projectId);
      this.projectModels.delete(projectId);
      console.log(`✓ 项目数据库连接已关闭: ${projectId}`);
    }
  }

  /**
   * 删除项目数据库
   * @param {string} projectId - 项目ID
   */
  async deleteProjectDb(projectId) {
    // 先关闭连接
    await this.closeProjectDb(projectId);

    // 删除数据库文件
    const dbPath = this.getProjectDbPath(projectId);

    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log(`✓ 项目数据库已删除: ${projectId}`);
    }
  }

  /**
   * 获取项目数据库文件路径
   * @param {string} projectId - 项目ID
   * @returns {string}
   */
  getProjectDbPath(projectId) {
    // 清理 projectId，防止路径遍历攻击
    const safeProjectId = projectId.replace(/[^a-zA-Z0-9-]/g, '');
    return path.join(this.projectDbDir, `${safeProjectId}.sqlite`);
  }

  /**
   * 关闭所有数据库连接
   */
  async closeAll() {
    // 关闭所有项目数据库
    for (const projectId of this.projectConnections.keys()) {
      await this.closeProjectDb(projectId);
    }

    // 关闭平台数据库
    if (this.platformDb) {
      await this.platformDb.close();
      this.platformDb = null;
      console.log('✓ 平台数据库连接已关闭');
    }
  }

  /**
   * 检查项目数据库是否存在
   * @param {string} projectId - 项目ID
   * @returns {boolean}
   */
  projectDbExists(projectId) {
    const dbPath = this.getProjectDbPath(projectId);
    return fs.existsSync(dbPath);
  }

  /**
   * 获取所有项目数据库列表
   * @returns {Array<string>} - 项目ID列表
   */
  getAllProjectDbs() {
    if (!fs.existsSync(this.projectDbDir)) {
      return [];
    }

    const files = fs.readdirSync(this.projectDbDir);
    return files
      .filter(file => file.endsWith('.sqlite'))
      .map(file => file.replace('.sqlite', ''));
  }
}

// 导出单例
const dbManager = new DatabaseManager();

module.exports = dbManager;
