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
    
    // 连接池限制：根据环境变量配置，默认值根据环境不同
    // 开发环境：10，生产环境：50
    this.connectionLimit = parseInt(process.env.DB_CONNECTION_LIMIT) || 
                          (process.env.NODE_ENV === 'production' ? 50 : 10);
    
    this.dbDir = path.join(__dirname, '..', 'databases');
    this.projectDbDir = path.join(this.dbDir, 'projects');

    // 确保目录存在
    this.ensureDirectories();
    
    // 连接池监控
    this.setupConnectionMonitoring();
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
   * 设置连接池监控
   */
  setupConnectionMonitoring() {
    // 只在开发环境且启用 DEBUG 时进行详细监控
    const enableDetailedMonitoring = process.env.NODE_ENV === 'development' && process.env.DEBUG === 'true';
    
    // 每5分钟检查一次连接数
    setInterval(() => {
      const activeConnections = this.projectConnections.size;
      
      // 警告：连接数接近限制（所有环境）
      if (activeConnections > this.connectionLimit * 0.8) {
        console.warn(`⚠️  数据库连接数接近限制: ${activeConnections}/${this.connectionLimit}`);
      }
      
      // 详细日志：仅在开发环境+DEBUG模式
      if (enableDetailedMonitoring) {
        console.debug(`📊 活动数据库连接: ${activeConnections}`);
        console.debug(`📊 连接列表: ${Array.from(this.projectConnections.keys()).join(', ')}`);
      }
    }, 5 * 60 * 1000);
    
    if (enableDetailedMonitoring) {
      console.log('🔍 数据库连接监控已启用（DEBUG模式）');
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
   * 验证项目ID格式（防止路径遍历攻击）
   * @param {string} projectId - 项目ID
   * @throws {Error} 如果格式无效
   */
  validateProjectId(projectId) {
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Invalid project ID: must be a non-empty string');
    }

    // 必须是标准UUID v4格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(projectId)) {
      console.error(`🚨 安全警告: 检测到无效的项目ID格式: ${projectId}`);
      throw new Error('Invalid project ID format: must be a valid UUID v4');
    }

    // 额外检查：不允许包含路径遍历字符
    const dangerousChars = ['..', '/', '\\', '\0', '%00'];
    for (const char of dangerousChars) {
      if (projectId.includes(char)) {
        console.error(`🚨 安全警告: 检测到路径遍历尝试: ${projectId}`);
        throw new Error('Security violation: path traversal attempt detected');
      }
    }

    return true;
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
   * 获取项目数据库文件路径（带完整安全验证）
   * @param {string} projectId - 项目ID
   * @returns {string} - 安全验证后的绝对路径
   * @throws {Error} 如果projectId无效或检测到路径遍历攻击
   */
  getSecureProjectDbPath(projectId) {
    // 1. 验证项目ID格式（UUID v4 + 路径遍历检查）
    this.validateProjectId(projectId);
    
    // 2. 构建数据库路径
    const dbPath = path.join(this.projectDbDir, `${projectId}.sqlite`);
    
    // 3. 规范化路径（解析 . 和 ..）
    const normalizedPath = path.normalize(dbPath);
    
    // 4. 解析为绝对路径
    const resolvedPath = path.resolve(normalizedPath);
    
    // 5. 验证最终路径在允许的目录内（防止遍历到父目录）
    const allowedDir = path.resolve(this.projectDbDir);
    if (!resolvedPath.startsWith(allowedDir)) {
      console.error(`🚨 安全警告: 路径遍历攻击被阻止`);
      console.error(`  请求路径: ${resolvedPath}`);
      console.error(`  允许目录: ${allowedDir}`);
      throw new Error('Security violation: path traversal detected');
    }
    
    return resolvedPath;
  }

  /**
   * 获取项目数据库文件路径（向后兼容，内部使用安全版本）
   * @param {string} projectId - 项目ID
   * @returns {string}
   */
  getProjectDbPath(projectId) {
    // 使用安全版本
    return this.getSecureProjectDbPath(projectId);
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
    try {
      // 安全验证
      this.validateProjectId(projectId);
      const dbPath = this.getSecureProjectDbPath(projectId);
      return fs.existsSync(dbPath);
    } catch (error) {
      console.error(`检查项目数据库失败: ${error.message}`);
      return false;
    }
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
