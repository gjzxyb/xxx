const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// 确保数据库目录存在
const dbDir = path.join(__dirname, '../../databases');
if (!fs.existsSync(dbDir)) {
  console.log('Creating databases directory:', dbDir);
  fs.mkdirSync(dbDir, { recursive: true });
} else {
  console.log('Databases directory exists:', dbDir);
}

const dbPath = path.join(dbDir, 'platform.db');
console.log('Platform DB path:', dbPath);

// 平台数据库（存储用户和项目信息）
const platformDb = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false
});

// 动态项目数据库连接池
const projectDbPool = new Map();

/**
 * 获取指定项目的数据库连接
 * @param {string} projectId - 项目ID
 * @returns {Sequelize} 数据库实例
 */
function getProjectDb(projectId) {
  if (!projectDbPool.has(projectId)) {
    const projectsDir = path.join(__dirname, '../../databases/projects');
    if (!fs.existsSync(projectsDir)) {
      fs.mkdirSync(projectsDir, { recursive: true });
    }

    const dbPath = path.join(projectsDir, `${projectId}.db`);
    const db = new Sequelize({
      dialect: 'sqlite',
      storage: dbPath,
      logging: false
    });
    projectDbPool.set(projectId, db);
  }
  return projectDbPool.get(projectId);
}

/**
 * 初始化新项目的数据库
 * @param {string} projectId - 项目ID
 */
async function initializeProjectDatabase(projectId) {
  const db = getProjectDb(projectId);

  // 定义User模型
  const User = db.define('User', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    studentId: {
      type: Sequelize.STRING(20),
      unique: true,
      allowNull: false,
      comment: '学号'
    },
    name: {
      type: Sequelize.STRING(50),
      allowNull: false,
      comment: '姓名'
    },
    password: {
      type: Sequelize.STRING(100),
      allowNull: false,
      comment: '密码(加密)'
    },
    className: {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: '班级'
    },
    role: {
      type: Sequelize.ENUM('student', 'admin'),
      defaultValue: 'student',
      comment: '角色'
    }
  }, {
    tableName: 'users',
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      }
    }
  });

  // 定义Subject模型
  const Subject = db.define('Subject', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: Sequelize.STRING(50),
      allowNull: false,
      comment: '科目名称'
    },
    category: {
      type: Sequelize.STRING(30),
      allowNull: false,
      comment: '分类'
    },
    description: {
      type: Sequelize.TEXT,
      comment: '描述'
    },
    capacity: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      comment: '容量限制'
    }
  }, {
    tableName: 'subjects'
  });

  // 定义Selection模型
  const Selection = db.define('Selection', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      field: 'user_id'
    },
    physicsHistorySubjectId: {
      type: Sequelize.INTEGER,
      field: 'physics_history_subject_id'
    },
    electiveOneSubjectId: {
      type: Sequelize.INTEGER,
      field: 'elective_one_subject_id'
    },
    electiveTwoSubjectId: {
      type: Sequelize.INTEGER,
      field: 'elective_two_subject_id'
    },
    status: {
      type: Sequelize.ENUM('submitted', 'confirmed', 'cancelled'),
      defaultValue: 'submitted'
    },
    submittedAt: {
      type: Sequelize.DATE,
      field: 'submitted_at'
    }
  }, {
    tableName: 'selections',
    timestamps: false
  });

  // 定义SystemConfig模型
  const SystemConfig = db.define('SystemConfig', {
    key: {
      type: Sequelize.STRING,
      primaryKey: true
    },
    value: {
      type: Sequelize.TEXT
    },
    description: {
      type: Sequelize.TEXT
    }
  }, {
    tableName: 'system_config',
    timestamps: false
  });

  // 建立关联
  Selection.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Selection.belongsTo(Subject, { foreignKey: 'physicsHistorySubjectId', as: 'physicsHistorySubject' });
  Selection.belongsTo(Subject, { foreignKey: 'electiveOneSubjectId', as: 'electiveOneSubject' });
  Selection.belongsTo(Subject, { foreignKey: 'electiveTwoSubjectId', as: 'electiveTwoSubject' });

  // 同步数据库
  await db.sync();

  // 初始化默认数据
  await SystemConfig.upsert({ key: 'selection_start_time', value: null });
  await SystemConfig.upsert({ key: 'selection_end_time', value: null });

  // 创建默认管理员（如果不存在）
  await User.findOrCreate({
    where: { studentId: 'admin' },
    defaults: {
      studentId: 'admin',
      name: '管理员',
      password: 'admin123',
      role: 'admin'
    }
  });

  return db;
}

module.exports = {
  platformDb,
  getProjectDb,
  initializeProjectDatabase
};
