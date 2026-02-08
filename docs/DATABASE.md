# 数据库配置指南

## 概述

本项目已支持多种数据库类型，可根据不同环境选择合适的数据库：

- **SQLite** - 开发环境（默认）
- **PostgreSQL** - 生产环境推荐
- **MySQL/MariaDB** - 生产环境备选

## 快速开始

### 开发环境（SQLite）

默认配置即可，无需额外设置：

```bash
# .env 文件
DB_DIALECT=sqlite
```

数据库文件位置：
- 主服务器：`server/data/database.sqlite`
- 平台服务器：`platform/databases/platform.db`
- 项目数据库：`platform/databases/projects/{projectId}.db`

### 生产环境（PostgreSQL）

#### 1. 安装 PostgreSQL

```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# macOS
brew install postgresql

# 启动服务
sudo systemctl start postgresql  # Linux
brew services start postgresql   # macOS
```

#### 2. 创建数据库

```bash
# 登录 PostgreSQL
sudo -u postgres psql

# 创建数据库用户
CREATE USER student_selection WITH PASSWORD 'your_secure_password';

# 创建主数据库
CREATE DATABASE student_selection OWNER student_selection;

# 创建平台数据库（如果使用平台服务器）
CREATE DATABASE student_selection_platform OWNER student_selection;

# 授予权限
GRANT ALL PRIVILEGES ON DATABASE student_selection TO student_selection;
GRANT ALL PRIVILEGES ON DATABASE student_selection_platform TO student_selection;
```

#### 3. 配置环境变量

在 `.env` 文件中添加：

```bash
# 数据库类型
DB_DIALECT=postgres

# PostgreSQL 连接配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=student_selection
DB_USER=student_selection
DB_PASSWORD=your_secure_password

# 平台数据库配置（平台服务器）
DB_PLATFORM_NAME=student_selection_platform
DB_PROJECT_PREFIX=project_

# 连接池配置
DB_POOL_MAX=50
DB_POOL_MIN=5

# 生产环境
NODE_ENV=production
```

#### 4. SSL 连接（推荐）

如果 PostgreSQL 启用了 SSL：

```bash
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
```

### 生产环境（MySQL）

#### 1. 安装 MySQL

```bash
# Ubuntu/Debian
sudo apt-get install mysql-server

# macOS
brew install mysql

# 启动服务
sudo systemctl start mysql  # Linux
brew services start mysql   # macOS
```

#### 2. 创建数据库

```bash
# 登录 MySQL
sudo mysql -u root -p

# 创建数据库
CREATE DATABASE student_selection CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE student_selection_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 创建用户并授权
CREATE USER 'student_selection'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON student_selection.* TO 'student_selection'@'localhost';
GRANT ALL PRIVILEGES ON student_selection_platform.* TO 'student_selection'@'localhost';
FLUSH PRIVILEGES;
```

#### 3. 配置环境变量

```bash
# 数据库类型
DB_DIALECT=mysql

# MySQL 连接配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=student_selection
DB_USER=student_selection
DB_PASSWORD=your_secure_password

# 平台数据库配置
DB_PLATFORM_NAME=student_selection_platform
DB_PROJECT_PREFIX=project_

# 连接池配置
DB_POOL_MAX=50
DB_POOL_MIN=5
```

## 连接池配置

### 为什么需要连接池？

连接池是生产环境高并发优化的关键，它可以：

- **提高性能**：复用数据库连接，避免频繁创建/销毁连接的开销
- **控制并发**：限制最大连接数，防止数据库过载
- **提升稳定性**：自动管理连接生命周期，处理超时和异常

### 连接池参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `DB_POOL_MAX` | 50 | 最大连接数 |
| `DB_POOL_MIN` | 5 | 最小连接数 |
| `acquire` | 30000ms | 获取连接的最大等待时间 |
| `idle` | 10000ms | 连接空闲超时时间 |
| `evict` | 1000ms | 连接池检查空闲连接的间隔 |

### 推荐配置

根据不同负载调整连接池大小：

```bash
# 低负载（<100 并发用户）
DB_POOL_MAX=20
DB_POOL_MIN=5

# 中等负载（100-500 并发用户）
DB_POOL_MAX=50
DB_POOL_MIN=10

# 高负载（>500 并发用户）
DB_POOL_MAX=100
DB_POOL_MIN=20
```

**注意**：最大连接数不应超过数据库服务器的 `max_connections` 设置。

## 高并发优化建议

### 1. 数据库层面

#### PostgreSQL 优化

```sql
-- 调整最大连接数
ALTER SYSTEM SET max_connections = 200;

-- 启用连接池
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';

-- 重启服务生效
sudo systemctl restart postgresql
```

#### MySQL 优化

```sql
-- my.cnf 配置
[mysqld]
max_connections = 200
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
query_cache_size = 64M
```

### 2. 应用层面

#### 索引优化

确保常用查询字段有索引：

```javascript
// 在模型中定义索引
const User = sequelize.define('User', {
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  username: {
    type: DataTypes.STRING,
    unique: true
  }
}, {
  indexes: [
    { fields: ['email'] },
    { fields: ['username'] },
    { fields: ['createdAt'] }
  ]
});
```

#### 查询优化

```javascript
// ✅ 好的做法：只查询需要的字段
const users = await User.findAll({
  attributes: ['id', 'username', 'email'],
  where: { active: true }
});

// ❌ 避免：查询所有字段
const users = await User.findAll();
```

#### 批量操作

```javascript
// ✅ 批量插入
await User.bulkCreate(users, { validate: true });

// ❌ 避免：循环插入
for (const user of users) {
  await User.create(user);
}
```

### 3. 读写分离（高级）

如果需要更高性能，可以配置主从复制：

```javascript
const sequelize = new Sequelize({
  replication: {
    read: [
      { host: 'read-replica-1', username: 'reader', password: 'pass' },
      { host: 'read-replica-2', username: 'reader', password: 'pass' }
    ],
    write: { host: 'master', username: 'writer', password: 'pass' }
  },
  pool: { max: 50, min: 10 }
});
```

## 数据迁移

### 从 SQLite 迁移到 PostgreSQL

#### 方法 1：使用 pgloader（推荐）

```bash
# 安装 pgloader
sudo apt-get install pgloader

# 迁移数据
pgloader sqlite://./server/data/database.sqlite \
         postgresql://student_selection:password@localhost/student_selection
```

#### 方法 2：手动导出导入

```bash
# 1. 导出 SQLite 数据为 SQL
sqlite3 server/data/database.sqlite .dump > dump.sql

# 2. 调整 SQL 语法（删除 SQLite 特有语法）
sed -i 's/AUTOINCREMENT/SERIAL/g' dump.sql

# 3. 导入 PostgreSQL
psql -U student_selection -d student_selection < dump.sql
```

## 故障排查

### 连接失败

```bash
# 检查数据库服务是否运行
sudo systemctl status postgresql  # PostgreSQL
sudo systemctl status mysql       # MySQL

# 测试连接
psql -U student_selection -d student_selection -h localhost  # PostgreSQL
mysql -u student_selection -p student_selection              # MySQL

# 检查防火墙
sudo ufw allow 5432  # PostgreSQL
sudo ufw allow 3306  # MySQL
```

### 连接池耗尽

如果出现 `TimeoutError: ResourceRequest timed out` 错误：

1. 增加 `DB_POOL_MAX` 值
2. 检查是否有未释放的连接
3. 优化慢查询

### 性能问题

```bash
# 启用 SQL 日志查看慢查询
DB_LOGGING=true

# PostgreSQL 慢查询日志
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- 记录超过1秒的查询
```

## 备份与恢复

### PostgreSQL

```bash
# 备份
pg_dump -U student_selection student_selection > backup.sql

# 恢复
psql -U student_selection student_selection < backup.sql

# 自动备份脚本
0 2 * * * pg_dump -U student_selection student_selection | gzip > /backups/$(date +\%Y\%m\%d).sql.gz
```

### MySQL

```bash
# 备份
mysqldump -u student_selection -p student_selection > backup.sql

# 恢复
mysql -u student_selection -p student_selection < backup.sql
```

## 安全建议

1. **使用强密码**：数据库密码至少16位，包含大小写字母、数字和特殊字符
2. **限制访问**：仅允许应用服务器 IP 访问数据库
3. **启用 SSL**：生产环境必须使用 SSL 加密连接
4. **定期备份**：每日自动备份，保留至少7天
5. **最小权限**：应用账号只授予必要的数据库权限
6. **监控日志**：定期检查数据库访问日志

## 环境变量参考

完整的数据库配置环境变量列表：

```bash
# 通用配置
DB_DIALECT=postgres          # 数据库类型：sqlite/postgres/mysql
DB_LOGGING=false             # 是否启用 SQL 日志

# PostgreSQL/MySQL 配置
DB_HOST=localhost            # 数据库主机
DB_PORT=5432                 # 端口（PostgreSQL: 5432, MySQL: 3306）
DB_NAME=student_selection    # 数据库名称
DB_USER=student_selection    # 用户名
DB_PASSWORD=your_password    # 密码
DB_SSL=false                 # 启用 SSL
DB_SSL_REJECT_UNAUTHORIZED=true  # SSL 证书验证

# 连接池配置
DB_POOL_MAX=50              # 最大连接数
DB_POOL_MIN=5               # 最小连接数

# 平台服务器专用
DB_PLATFORM_NAME=student_selection_platform  # 平台数据库名称
DB_PROJECT_PREFIX=project_                   # 项目数据库前缀

# SQLite 专用
DB_PATH=./data/database.sqlite  # SQLite 文件路径
```

## 相关资源

- [PostgreSQL 官方文档](https://www.postgresql.org/docs/)
- [MySQL 官方文档](https://dev.mysql.com/doc/)
- [Sequelize 文档](https://sequelize.org/)
- [数据库连接池最佳实践](https://github.com/sequelize/sequelize/blob/main/docs/connection-pool.md)
