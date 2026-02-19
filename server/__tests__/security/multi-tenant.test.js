/**
 * 多租户隔离测试
 * 验证项目间数据完全隔离
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// 设置测试环境
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

describe('多租户隔离测试', () => {
  let app;
  let project1Id, project2Id;
  let admin1Token, admin2Token;
  let student1Token, student2Token;

  beforeAll(async () => {
    // 清理测试数据库
    const testDbDir = path.join(__dirname, '../../databases/test');
    if (fs.existsSync(testDbDir)) {
      fs.rmSync(testDbDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDbDir, { recursive: true });

    // 动态导入app（避免在设置环境变量前加载）
    delete require.cache[require.resolve('../../app.js')];
    app = require('../../app.js');
  });

  describe('项目创建和隔离', () => {
    test('应该能创建两个独立项目', async () => {
      // 创建项目1
      project1Id = uuidv4();
      const res1 = await request(app)
        .post('/api/platform/projects')
        .send({
          id: project1Id,
          name: '测试学校A',
          description: '多租户测试项目A'
        });

      expect(res1.status).toBe(201);
      expect(res1.body.data.id).toBe(project1Id);

      // 创建项目2
      project2Id = uuidv4();
      const res2 = await request(app)
        .post('/api/platform/projects')
        .send({
          id: project2Id,
          name: '测试学校B',
          description: '多租户测试项目B'
        });

      expect(res2.status).toBe(201);
      expect(res2.body.data.id).toBe(project2Id);
    });

    test('每个项目应该有独立的数据库文件', () => {
      const db1Path = path.join(__dirname, `../../databases/project_${project1Id}.db`);
      const db2Path = path.join(__dirname, `../../databases/project_${project2Id}.db`);

      expect(fs.existsSync(db1Path)).toBe(true);
      expect(fs.existsSync(db2Path)).toBe(true);
    });
  });

  describe('管理员隔离测试', () => {
    test('应该能为每个项目创建独立的管理员', async () => {
      // 项目1管理员
      const res1 = await request(app)
        .post(`/api/auth/register?projectId=${project1Id}`)
        .send({
          studentId: 'admin1',
          name: '管理员A',
          password: 'Admin123!',
          role: 'admin'
        });

      expect(res1.status).toBe(201);
      admin1Token = res1.body.data.token;

      // 项目2管理员
      const res2 = await request(app)
        .post(`/api/auth/register?projectId=${project2Id}`)
        .send({
          studentId: 'admin2',
          name: '管理员B',
          password: 'Admin123!',
          role: 'admin'
        });

      expect(res2.status).toBe(201);
      admin2Token = res2.body.data.token;
    });

    test('管理员只能访问自己项目的数据', async () => {
      // 管理员1尝试访问项目2的数据（应该失败）
      const res = await request(app)
        .get('/api/admin/students')
        .set('Authorization', `Bearer ${admin1Token}`)
        .query({ projectId: project2Id });

      expect(res.status).toBe(403); // 或401，取决于实现
    });
  });

  describe('学生数据隔离测试', () => {
    test('应该能在每个项目中创建学生', async () => {
      // 项目1学生
      const res1 = await request(app)
        .post('/api/admin/students')
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({
          studentId: '2024001',
          name: '学生A1',
          className: '高一1班',
          password: 'Student123!'
        });

      expect(res1.status).toBe(201);

      // 项目2学生（相同学号）
      const res2 = await request(app)
        .post('/api/admin/students')
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({
          studentId: '2024001', // 相同学号，但在不同项目
          name: '学生B1',
          className: '高一1班',
          password: 'Student123!'
        });

      expect(res2.status).toBe(201);
    });

    test('相同学号的学生应该在不同项目中独立存在', async () => {
      // 项目1学生登录
      const login1 = await request(app)
        .post('/api/auth/login')
        .send({
          studentId: '2024001',
          password: 'Student123!',
          projectId: project1Id
        });

      expect(login1.status).toBe(200);
      expect(login1.body.data.user.name).toBe('学生A1');
      student1Token = login1.body.data.token;

      // 项目2学生登录
      const login2 = await request(app)
        .post('/api/auth/login')
        .send({
          studentId: '2024001',
          password: 'Student123!',
          projectId: project2Id
        });

      expect(login2.status).toBe(200);
      expect(login2.body.data.user.name).toBe('学生B1');
      student2Token = login2.body.data.token;
    });

    test('学生只能查看自己项目的数据', async () => {
      // 项目1学生查看自己的选科
      const res1 = await request(app)
        .get('/api/selections/my')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res1.status).toBe(200);

      // 项目1学生尝试访问项目2（应该失败）
      const res2 = await request(app)
        .get('/api/selections/my')
        .set('Authorization', `Bearer ${student1Token}`)
        .query({ projectId: project2Id });

      expect(res2.status).toBe(403);
    });
  });

  describe('科目数据隔离测试', () => {
    test('每个项目应该有独立的科目列表', async () => {
      // 项目1创建科目
      const res1 = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({
          name: '物理A',
          category: 'physics_history',
          maxCapacity: 100
        });

      expect(res1.status).toBe(201);

      // 项目2创建科目
      const res2 = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({
          name: '物理B',
          category: 'physics_history',
          maxCapacity: 50
        });

      expect(res2.status).toBe(201);

      // 验证项目1只能看到自己的科目
      const subjects1 = await request(app)
        .get('/api/subjects')
        .set('Authorization', `Bearer ${admin1Token}`);

      expect(subjects1.body.data).toHaveLength(1);
      expect(subjects1.body.data[0].name).toBe('物理A');

      // 验证项目2只能看到自己的科目
      const subjects2 = await request(app)
        .get('/api/subjects')
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(subjects2.body.data).toHaveLength(1);
      expect(subjects2.body.data[0].name).toBe('物理B');
    });
  });

  describe('选科数据隔离测试', () => {
    test('每个项目的选科数据应该完全隔离', async () => {
      // 项目1学生选科
      const selection1 = await request(app)
        .post('/api/selections')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          physicsOrHistory: 1,
          electiveOne: 2,
          electiveTwo: 3
        });

      expect(selection1.status).toBe(200);

      // 项目2学生选科
      const selection2 = await request(app)
        .post('/api/selections')
        .set('Authorization', `Bearer ${student2Token}`)
        .send({
          physicsOrHistory: 1,
          electiveOne: 2,
          electiveTwo: 3
        });

      expect(selection2.status).toBe(200);

      // 验证项目1管理员只能看到项目1的选科
      const stats1 = await request(app)
        .get('/api/selections/stats')
        .set('Authorization', `Bearer ${admin1Token}`);

      expect(stats1.status).toBe(200);
      expect(stats1.body.data.overview.submittedCount).toBe(1);

      // 验证项目2管理员只能看到项目2的选科
      const stats2 = await request(app)
        .get('/api/selections/stats')
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(stats2.status).toBe(200);
      expect(stats2.body.data.overview.submittedCount).toBe(1);
    });
  });

  describe('跨项目访问防护测试', () => {
    test('应该阻止使用错误projectId的JWT访问', async () => {
      // 尝试使用项目1的token访问项目2的数据
      const res = await request(app)
        .get('/api/subjects')
        .set('Authorization', `Bearer ${admin1Token}`)
        .set('X-Project-Id', project2Id); // 尝试伪造项目ID

      expect(res.status).toBe(403);
    });

    test('应该阻止SQL注入尝试跨项目访问', async () => {
      const maliciousProjectId = `${project1Id}' OR '1'='1`;

      const res = await request(app)
        .get('/api/subjects')
        .set('Authorization', `Bearer ${admin1Token}`)
        .query({ projectId: maliciousProjectId });

      expect(res.status).toBe(400); // 或403
    });
  });

  afterAll(async () => {
    // 清理测试数据
    const testDbDir = path.join(__dirname, '../../databases/test');
    if (fs.existsSync(testDbDir)) {
      fs.rmSync(testDbDir, { recursive: true, force: true });
    }
  });
});
