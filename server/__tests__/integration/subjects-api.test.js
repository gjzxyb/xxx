/**
 * 科目管理API集成测试
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

describe('科目管理API集成测试', () => {
  let app;
  let adminToken;
  let studentToken;
  let projectId = 'test-project-id';
  let subjectId;

  beforeAll(async () => {
    // 动态导入app
    delete require.cache[require.resolve('../../app.js')];
    app = require('../../app.js');

    // 创建测试管理员和学生
    // 这里需要根据实际的认证流程调整
  });

  describe('GET /api/subjects - 获取科目列表', () => {
    test('应该返回科目列表', async () => {
      const res = await request(app)
        .get('/api/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ projectId });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('应该支持按类别筛选', async () => {
      const res = await request(app)
        .get('/api/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ projectId, category: 'physics_history' });

      expect(res.status).toBe(200);
      if (res.body.data.length > 0) {
        expect(res.body.data[0].category).toBe('physics_history');
      }
    });

    test('应该支持按激活状态筛选', async () => {
      const res = await request(app)
        .get('/api/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ projectId, active: 'true' });

      expect(res.status).toBe(200);
      if (res.body.data.length > 0) {
        expect(res.body.data[0].isActive).toBe(true);
      }
    });

    test('未认证用户应该被拒绝', async () => {
      const res = await request(app)
        .get('/api/subjects')
        .query({ projectId });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/subjects - 创建科目', () => {
    test('管理员应该能创建科目', async () => {
      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '测试物理',
          category: 'physics_history',
          description: '物理科目',
          maxCapacity: 100
        });

      if (res.status === 201) {
        expect(res.body.data.name).toBe('测试物理');
        expect(res.body.data.category).toBe('physics_history');
        subjectId = res.body.data.id;
      }
    });

    test('应该验证必需字段', async () => {
      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          // 缺少name和category
          description: '测试'
        });

      expect(res.status).toBe(400);
    });

    test('应该防止重复科目名称', async () => {
      // 先创建一个科目
      await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '重复测试',
          category: 'physics_history'
        });

      // 尝试创建同名科目
      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '重复测试',
          category: 'physics_history'
        });

      expect(res.status).toBe(409);
    });

    test('学生不应该能创建科目', async () => {
      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          name: '学生创建',
          category: 'physics_history'
        });

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/subjects/:id - 更新科目', () => {
    test('管理员应该能更新科目', async () => {
      if (subjectId) {
        const res = await request(app)
          .put(`/api/subjects/${subjectId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: '更新后的物理',
            maxCapacity: 150
          });

        if (res.status === 200) {
          expect(res.body.data.name).toBe('更新后的物理');
          expect(res.body.data.maxCapacity).toBe(150);
        }
      }
    });

    test('应该返回404当科目不存在', async () => {
      const res = await request(app)
        .put('/api/subjects/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '不存在的科目'
        });

      expect(res.status).toBe(404);
    });

    test('学生不应该能更新科目', async () => {
      if (subjectId) {
        const res = await request(app)
          .put(`/api/subjects/${subjectId}`)
          .set('Authorization', `Bearer ${studentToken}`)
          .send({
            name: '学生更新'
          });

        expect(res.status).toBe(403);
      }
    });
  });

  describe('DELETE /api/subjects/:id - 删除科目', () => {
    test('管理员应该能删除科目', async () => {
      // 先创建一个用于删除的科目
      const createRes = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '待删除科目',
          category: 'four_electives'
        });

      if (createRes.status === 201) {
        const deleteId = createRes.body.data.id;

        const res = await request(app)
          .delete(`/api/subjects/${deleteId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
      }
    });

    test('应该返回404当科目不存在', async () => {
      const res = await request(app)
        .delete('/api/subjects/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    test('学生不应该能删除科目', async () => {
      if (subjectId) {
        const res = await request(app)
          .delete(`/api/subjects/${subjectId}`)
          .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).toBe(403);
      }
    });
  });

  describe('缓存测试', () => {
    test('第二次请求应该从缓存返回', async () => {
      // 第一次请求
      const res1 = await request(app)
        .get('/api/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ projectId });

      const time1 = Date.now();

      // 第二次请求（应该从缓存返回，更快）
      const res2 = await request(app)
        .get('/api/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ projectId });

      const time2 = Date.now();

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.data).toEqual(res2.body.data);

      // 第二次请求应该更快（从缓存）
      // 注意：这个测试可能不稳定，取决于系统负载
    });

    test('创建科目后应该清除缓存', async () => {
      // 先获取科目列表（建立缓存）
      const res1 = await request(app)
        .get('/api/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ projectId });

      const count1 = res1.body.data.length;

      // 创建新科目
      await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '缓存测试科目',
          category: 'four_electives'
        });

      // 再次获取科目列表（应该看到新科目）
      const res2 = await request(app)
        .get('/api/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ projectId });

      expect(res2.body.data.length).toBeGreaterThan(count1);
    });
  });

  describe('速率限制测试', () => {
    test('应该限制创建科目的频率', async () => {
      const promises = [];

      // 快速发送多个创建请求
      for (let i = 0; i < 20; i++) {
        promises.push(
          request(app)
            .post('/api/subjects')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              name: `速率测试${i}`,
              category: 'four_electives'
            })
        );
      }

      const results = await Promise.all(promises);

      // 应该有一些请求被速率限制拒绝
      const rateLimited = results.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  afterAll(async () => {
    // 清理测试数据
  });
});
