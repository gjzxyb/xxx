# Redis 配置指南

## 为什么需要 Redis？

当前系统使用内存存储以下数据，这在多实例部署时会导致问题：
- 验证码（VerificationCodeManager）
- 登录失败记录（LoginAttemptTracker）  
- CSRF Token
- Token 黑名单（TokenBlacklist）

## Docker 快速启动 Redis

```bash
# 启动 Redis 容器
docker run -d \
  --name student-selection-redis \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:7-alpine \
  redis-server --appendonly yes --requirepass your_redis_password

# 查看运行状态
docker ps | grep redis
```

## 环境变量配置

在 `.env` 文件中添加：

```bash
# Redis 配置
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0
```

## 代码修改

VerificationCodeManager 已经支持 Redis，只需要：

1. 安装 Redis 客户端：
```bash
cd server
npm install ioredis
```

2. 确保环境变量 `REDIS_ENABLED=true`

3. 重启服务器

## 生产环境建议

1. **使用 Redis 集群**：高可用性部署
2. **配置持久化**：防止数据丢失
3. **设置密码**：增强安全性
4. **网络隔离**：Redis 不暴露在公网
5. **定期备份**：RDB 或 AOF 备份

## 验证 Redis 连接

启动服务器后查看日志：
```
✓ Redis 连接成功
✓ 验证码管理器已切换到 Redis 模式
```

## 故障排查

如果 Redis 连接失败，系统会自动回退到内存模式：
```
⚠️  Redis 连接失败，使用内存存储（不支持多实例）
```
