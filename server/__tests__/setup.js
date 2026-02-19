/**
 * Jest 测试环境设置
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
process.env.REDIS_ENABLED = 'false'; // 测试环境禁用Redis
process.env.EMAIL_USER = 'test@example.com';
process.env.EMAIL_PASSWORD = 'test-password';

// 增加测试超时时间
jest.setTimeout(10000);

// 全局测试钩子
beforeAll(() => {
  console.log('🧪 开始测试套件...');
});

afterAll(() => {
  console.log('✅ 测试套件完成');
});
