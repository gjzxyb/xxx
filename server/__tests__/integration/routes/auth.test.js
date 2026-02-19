const request = require('supertest');
const app = require('../../../app');
const DatabaseManager = require('../../../lib/DatabaseManager');

describe('认证路由集成测试', () => {
  let testProjectId;
  let testUser;

  beforeAll(async () => {
    // 创建测试项目数据库
    testProjectId = 'test-project-' + Date.now();
    const models = await DatabaseManager.getProjectModels(testProjectId);

    // 创建测试用户
    testUser = await models.User.create({
      studentId: 'TEST001',
      name: '测试用户',
      className: '测试班级',
      password: 'Test123456',
      role: 'student'
    });
  });

  afterAll(async () => {
    // 清理测试数据
    await DatabaseManager.closeProjectDb(testProjectId);
  });

  describe('POST /api/auth/login', () => {
    it('应该成功登录并返回 token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          studentId: 'TEST001',
          password: 'Test123456',
          projectId: testProjectId
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('登录成功');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user).toMatchObject({
        studentId: 'TEST001',
        name: '测试用户',
        role: 'student'
      });
    });

    it('应该拒绝错误的密码', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          studentId: 'TEST001',
          password: 'WrongPassword',
          projectId: testProjectId
        })
        .expect(401);

      expect(response.body.code).toBe(401);
      expect(response.body.message).toContain('密码错误');
    });

    it('应该拒绝不存在的学号', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          studentId: 'NOTEXIST',
          password: 'Test123456',
          projectId: testProjectId
        })
        .expect(401);

      expect(response.body.code).toBe(401);
    });

    it('应该验证必填字段', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          studentId: 'TEST001'
          // 缺少 password 和 projectId
        })
        .expect(400);

      expect(response.body.code).toBe(400);
    });

    it('应该拒绝无效的项目ID', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          studentId: 'TEST001',
          password: 'Test123456',
          projectId: 'invalid-project'
        })
        .expect(404);

      expect(response.body.code).toBe(404);
      expect(response.body.message).toContain('项目不存在');
    });
  });

  describe('GET /api/auth/profile', () => {
    let authToken;

    beforeAll(async () => {
      // 先登录获取 token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          studentId: 'TEST001',
          password: 'Test123456',
          projectId: testProjectId
        });

      authToken = loginResponse.body.data.token;
    });

    it('应该返回当前用户信息', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data).toMatchObject({
        studentId: 'TEST001',
        name: '测试用户',
        className: '测试班级',
        role: 'student'
      });
      expect(response.body.data.password).toBeUndefined();
    });

    it('应该拒绝未认证的请求', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body.code).toBe(401);
    });

    it('应该拒绝无效的 token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.code).toBe(401);
    });
  });

  describe('PUT /api/auth/password', () => {
    let authToken;

    beforeEach(async () => {
      // 重置密码为初始值
      await testUser.update({ password: 'Test123456' });

      // 登录获取 token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          studentId: 'TEST001',
          password: 'Test123456',
          projectId: testProjectId
        });

      authToken = loginResponse.body.data.token;
    });

    it('应该成功修改密码', async () => {
      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          oldPassword: 'Test123456',
          newPassword: 'NewPass789!'
        })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toContain('成功');

      // 验证新密码可以登录
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          studentId: 'TEST001',
          password: 'NewPass789!',
          projectId: testProjectId
        })
        .expect(200);

      expect(loginResponse.body.code).toBe(200);
    });

    it('应该拒绝错误的旧密码', async () => {
      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          oldPassword: 'WrongOldPassword',
          newPassword: 'NewPass789!'
        })
        .expect(401);

      expect(response.body.code).toBe(401);
      expect(response.body.message).toContain('旧密码错误');
    });

    it('应该验证新密码格式', async () => {
      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          oldPassword: 'Test123456',
          newPassword: 'weak'  // 不符合密码策略
        })
        .expect(400);

      expect(response.body.code).toBe(400);
    });
  });

  describe('POST /api/auth/logout', () => {
    let authToken;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          studentId: 'TEST001',
          password: 'Test123456',
          projectId: testProjectId
        });

      authToken = loginResponse.body.data.token;
    });

    it('应该成功退出登录', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toContain('退出登录成功');
    });

    it('应该拒绝未认证的请求', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body.code).toBe(401);
    });
  });
});
