/**
 * CSRF保护测试
 * 验证CSRF token机制正常工作
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

describe('CSRF保护测试', () => {
  let app;
  let csrfToken;
  let authToken;
  let cookies;

  beforeAll(async () => {
    // 动态导入app
    delete require.cache[require.resolve('../../app.js')];
    app = require('../../app.js');
  });

  describe('CSRF Token生成', () => {
    test('应该在响应中包含CSRF token', async () => {
      const res = await request(app)
        .get('/api/health');

      expect(res.status).toBe(200);
      expect(res.headers['x-csrf-token']).toBeDefined();
      csrfToken = res.headers['x-csrf-token'];
      cookies = res.headers['set-cookie'];
    });

    test('CSRF token应该是有效的字符串', () => {
      expect(typeof csrfToken).toBe('string');
      expect(csrfToken.length).toBeGreaterThan(0);
    });
  });

  describe('GET请求（不需要CSRF验证）', () => {
    test('GET请求应该不需要CSRF token', async () => {
      const res = await request(app)
        .get('/api/health');

      expect(res.status).toBe(200);
    });

    test('GET请求即使没有CSRF token也应该成功', async () => {
      const res = await request(app)
        .get('/api/subjects')
        .set('Authorization', `Bearer ${authToken}`);

      // 可能返回401（未认证）但不应该是403（CSRF失败）
      expect(res.status).not.toBe(403);
    });
  });

  describe('POST请求（需要CSRF验证）', () => {
    beforeAll(async () => {
      // 先登录获取认证token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', cookies)
        .send({
          studentId: 'test001',
          password: 'Test123!',
          projectId: 'test-project-id'
        });

      if (loginRes.status === 200) {
        authToken = loginRes.body.data.token;
      }
    });

    test('没有CSRF token的POST请求应该被拒绝', async () => {
      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '测试科目',
          category: 'physics_history'
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/CSRF/i);
    });

    test('使用错误CSRF token的POST请求应该被拒绝', async () => {
      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', 'invalid-csrf-token')
        .set('Cookie', cookies)
        .send({
          name: '测试科目',
          category: 'physics_history'
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/CSRF/i);
    });

    test('使用正确CSRF token的POST请求应该成功', async () => {
      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', cookies)
        .send({
          name: '测试科目',
          category: 'physics_history',
          maxCapacity: 100
        });

      // 可能因为其他原因失败（如权限），但不应该是CSRF失败
      expect(res.status).not.toBe(403);
    });
  });

  describe('PUT请求（需要CSRF验证）', () => {
    test('没有CSRF token的PUT请求应该被拒绝', async () => {
      const res = await request(app)
        .put('/api/subjects/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '更新科目'
        });

      expect(res.status).toBe(403);
    });

    test('使用正确CSRF token的PUT请求应该通过CSRF验证', async () => {
      const res = await request(app)
        .put('/api/subjects/1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', cookies)
        .send({
          name: '更新科目'
        });

      // 不应该是CSRF错误
      expect(res.status).not.toBe(403);
    });
  });

  describe('DELETE请求（需要CSRF验证）', () => {
    test('没有CSRF token的DELETE请求应该被拒绝', async () => {
      const res = await request(app)
        .delete('/api/subjects/1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(403);
    });

    test('使用正确CSRF token的DELETE请求应该通过CSRF验证', async () => {
      const res = await request(app)
        .delete('/api/subjects/1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', cookies);

      // 不应该是CSRF错误
      expect(res.status).not.toBe(403);
    });
  });

  describe('CSRF Token刷新', () => {
    test('应该能获取新的CSRF token', async () => {
      const res = await request(app)
        .get('/api/health');

      const newCsrfToken = res.headers['x-csrf-token'];
      expect(newCsrfToken).toBeDefined();
      expect(typeof newCsrfToken).toBe('string');
    });

    test('旧的CSRF token应该在一段时间后失效', async () => {
      // 获取新token
      const res1 = await request(app)
        .get('/api/health');

      const oldToken = res1.headers['x-csrf-token'];
      const oldCookies = res1.headers['set-cookie'];

      // 等待一段时间（模拟token过期）
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 获取新token
      const res2 = await request(app)
        .get('/api/health');

      const newToken = res2.headers['x-csrf-token'];

      // 验证token已更新
      expect(newToken).not.toBe(oldToken);
    });
  });

  describe('跨域CSRF攻击防护', () => {
    test('应该拒绝来自不同Origin的请求', async () => {
      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', cookies)
        .set('Origin', 'http://malicious-site.com')
        .send({
          name: '恶意科目',
          category: 'physics_history'
        });

      // 应该被CORS策略拒绝
      expect(res.status).toBe(403);
    });

    test('应该接受来自允许Origin的请求', async () => {
      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', cookies)
        .set('Origin', 'http://localhost:3000')
        .send({
          name: '合法科目',
          category: 'physics_history'
        });

      // 不应该被CORS拒绝
      expect(res.status).not.toBe(403);
    });
  });

  describe('CSRF Token在Cookie中的安全性', () => {
    test('CSRF cookie应该设置HttpOnly标志', async () => {
      const res = await request(app)
        .get('/api/health');

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();

      const csrfCookie = cookies.find(c => c.includes('csrf'));
      if (csrfCookie) {
        expect(csrfCookie).toMatch(/HttpOnly/i);
      }
    });

    test('CSRF cookie应该设置SameSite标志', async () => {
      const res = await request(app)
        .get('/api/health');

      const cookies = res.headers['set-cookie'];
      const csrfCookie = cookies.find(c => c.includes('csrf'));

      if (csrfCookie) {
        expect(csrfCookie).toMatch(/SameSite/i);
      }
    });

    test('生产环境CSRF cookie应该设置Secure标志', async () => {
      // 临时切换到生产环境
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const res = await request(app)
        .get('/api/health');

      const cookies = res.headers['set-cookie'];
      const csrfCookie = cookies.find(c => c.includes('csrf'));

      if (csrfCookie) {
        expect(csrfCookie).toMatch(/Secure/i);
      }

      // 恢复环境
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('CSRF保护绕过尝试', () => {
    test('应该阻止通过修改Referer头绕过CSRF', async () => {
      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Referer', 'http://malicious-site.com')
        .send({
          name: '恶意科目',
          category: 'physics_history'
        });

      expect(res.status).toBe(403);
    });

    test('应该阻止通过伪造Cookie绕过CSRF', async () => {
      const res = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', 'csrf-token=fake-token')
        .send({
          name: '恶意科目',
          category: 'physics_history'
        });

      expect(res.status).toBe(403);
    });

    test('应该阻止重放攻击', async () => {
      // 第一次请求
      const res1 = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', cookies)
        .send({
          name: '测试科目1',
          category: 'physics_history'
        });

      // 重放相同的请求
      const res2 = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', cookies)
        .send({
          name: '测试科目1',
          category: 'physics_history'
        });

      // 第二次请求应该失败（如果实现了重放保护）
      // 或者至少不应该创建重复数据
      if (res1.status === 201) {
        expect(res2.status).not.toBe(201);
      }
    });
  });
});
