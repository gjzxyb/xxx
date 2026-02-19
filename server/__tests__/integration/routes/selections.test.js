const request = require('supertest');
const app = require('../../../app');
const DatabaseManager = require('../../../lib/DatabaseManager');

describe('选科路由集成测试', () => {
  let testProjectId;
  let testUser;
  let authToken;
  let subjects;

  beforeAll(async () => {
    // 创建测试项目数据库
    testProjectId = 'test-selection-' + Date.now();
    const models = await DatabaseManager.getProjectModels(testProjectId);

    // 创建测试用户
    testUser = await models.User.create({
      studentId: 'SEL001',
      name: '选科测试用户',
      className: '高一(1)班',
      password: 'Test123456',
      role: 'student'
    });

    // 创建测试科目
    subjects = {
      physics: await models.Subject.create({
        name: '物理',
        code: 'PHY',
        category: '首选',
        capacity: 50,
        selectedCount: 0
      }),
      history: await models.Subject.create({
        name: '历史',
        code: 'HIS',
        category: '首选',
        capacity: 50,
        selectedCount: 0
      }),
      chemistry: await models.Subject.create({
        name: '化学',
        code: 'CHE',
        category: '再选',
        capacity: 40,
        selectedCount: 0
      }),
      biology: await models.Subject.create({
        name: '生物',
        code: 'BIO',
        category: '再选',
        capacity: 40,
        selectedCount: 0
      })
    };

    // 登录获取 token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        studentId: 'SEL001',
        password: 'Test123456',
        projectId: testProjectId
      });

    authToken = loginResponse.body.data.token;
  });

  afterAll(async () => {
    await DatabaseManager.closeProjectDb(testProjectId);
  });

  describe('POST /api/selections', () => {
    it('应该成功提交选科', async () => {
      const response = await request(app)
        .post('/api/selections')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstChoiceId: subjects.physics.id,
          secondChoiceId: subjects.chemistry.id,
          thirdChoiceId: subjects.biology.id
        })
        .expect(201);

      expect(response.body.code).toBe(201);
      expect(response.body.message).toContain('成功');
      expect(response.body.data).toMatchObject({
        userId: testUser.id,
        firstChoiceId: subjects.physics.id,
        secondChoiceId: subjects.chemistry.id,
        thirdChoiceId: subjects.biology.id
      });
    });

    it('应该拒绝重复提交', async () => {
      const response = await request(app)
        .post('/api/selections')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstChoiceId: subjects.physics.id,
          secondChoiceId: subjects.chemistry.id,
          thirdChoiceId: subjects.biology.id
        })
        .expect(409);

      expect(response.body.code).toBe(409);
      expect(response.body.message).toContain('已提交');
    });

    it('应该验证首选科目类别', async () => {
      const response = await request(app)
        .post('/api/selections')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstChoiceId: subjects.chemistry.id, // 错误：化学是再选科目
          secondChoiceId: subjects.chemistry.id,
          thirdChoiceId: subjects.biology.id
        })
        .expect(400);

      expect(response.body.code).toBe(400);
      expect(response.body.message).toContain('首选');
    });

    it('应该验证再选科目类别', async () => {
      const response = await request(app)
        .post('/api/selections')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstChoiceId: subjects.physics.id,
          secondChoiceId: subjects.history.id, // 错误：历史是首选科目
          thirdChoiceId: subjects.biology.id
        })
        .expect(400);

      expect(response.body.code).toBe(400);
      expect(response.body.message).toContain('再选');
    });

    it('应该拒绝选择相同的再选科目', async () => {
      const response = await request(app)
        .post('/api/selections')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstChoiceId: subjects.physics.id,
          secondChoiceId: subjects.chemistry.id,
          thirdChoiceId: subjects.chemistry.id // 重复
        })
        .expect(400);

      expect(response.body.code).toBe(400);
      expect(response.body.message).toContain('不能重复');
    });
  });

  describe('GET /api/selections/my', () => {
    it('应该返回我的选科信息', async () => {
      const response = await request(app)
        .get('/api/selections/my')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data).toMatchObject({
        userId: testUser.id,
        firstChoiceId: subjects.physics.id,
        secondChoiceId: subjects.chemistry.id,
        thirdChoiceId: subjects.biology.id
      });
      expect(response.body.data.firstChoice).toMatchObject({
        name: '物理',
        code: 'PHY'
      });
    });

    it('应该拒绝未认证的请求', async () => {
      const response = await request(app)
        .get('/api/selections/my')
        .expect(401);

      expect(response.body.code).toBe(401);
    });
  });

  describe('GET /api/subjects', () => {
    it('应该返回所有科目列表', async () => {
      const response = await request(app)
        .get('/api/subjects')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('name');
      expect(response.body.data[0]).toHaveProperty('category');
      expect(response.body.data[0]).toHaveProperty('capacity');
    });

    it('应该支持按类别筛选', async () => {
      const response = await request(app)
        .get('/api/subjects?category=首选')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.data.every(s => s.category === '首选')).toBe(true);
    });
  });
});
