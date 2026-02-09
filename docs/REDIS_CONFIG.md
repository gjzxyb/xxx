# Redis 配置说明

## 开发环境 vs 生产环境

### 开发环境（推荐配置）
```env
REDIS_ENABLED=false
```
- ✅ 无需安装 Redis
- ✅ 启动快速，配置简单
- ✅ 适合单人开发、测试
- ⚠️ 服务重启后登录锁定记录会丢失

### 生产环境（推荐配置）
```env
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_secure_password
REDIS_DB=0
```
- ✅ 数据持久化
- ✅ 支持分布式部署（多服务器共享数据）
- ✅ 高性能
- ⚠️ 需要安装和维护 Redis 服务

## Redis 的作用

本系统使用 Redis 存储以下数据：

1. **登录失败锁定记录** - 防止暴力破解
2. **Token 黑名单** - 用户登出后的 token 失效
3. **验证码** - 邮箱验证码临时存储
4. **会话管理** - 用户会话信息

## 安装 Redis（生产环境）

### Windows
1. 下载 Redis for Windows: https://github.com/microsoftarchive/redis/releases
2. 解压并运行 `redis-server.exe`
3. 默认端口 6379

### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

### macOS
```bash
brew install redis
brew services start redis
```

### Docker
```bash
docker run -d -p 6379:6379 --name redis redis:latest
```

## 配置示例

### 本地 Redis
```env
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
```

### 带密码的 Redis
```env
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_password_here
```

### 远程 Redis
```env
REDIS_ENABLED=true
REDIS_URL=redis://your-redis-host:6379
REDIS_PASSWORD=your_password_here
REDIS_DB=0
```

## 常见问题

**Q: 开发环境必须安装 Redis 吗？**
A: 不需要。设置 `REDIS_ENABLED=false` 即可使用内存存储。

**Q: 内存存储的缺点是什么？**
A: 服务重启后，登录锁定记录、验证码等临时数据会丢失。但对开发环境影响不大。

**Q: 如何从内存存储迁移到 Redis？**
A: 只需修改 .env 文件设置 `REDIS_ENABLED=true` 并配置 Redis 连接信息，然后重启服务即可。

**Q: Redis 会影响性能吗？**
A: 不会。Redis 是高性能的内存数据库，通常比内存存储更快（特别是分布式环境）。
