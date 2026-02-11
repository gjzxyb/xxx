/**
 * 认证中间件测试
 */

const jwt = require('jsonwebtoken');
const { generateToken, generateDownloadToken } = require('../../middleware/auth');

// Mock dependencies
jest.mock('../../models', () => ({
  User: {
    findByPk: jest.fn()
  }
}));

jest.mock('../../lib/TokenBlacklist', () => ({
  isBlacklisted: jest.fn()
}));

describe('Auth Middleware', () => {
  describe('generateToken', () => {
    test('应该生成有效的JWT token', () => {
      const user = {
        id: 1,
        role: 'student'
      };

      const token = generateToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // 验证token可以被解码
      const decoded = jwt.decode(token);
      expect(decoded.userId).toBe(1);
      expect(decoded.role).toBe('student');
    });

    test('应该在token中包含projectId', () => {
      const user = {
        id: 1,
        role: 'admin',
        projectId: 'project-123'
      };

      const token = generateToken(user);
      const decoded = jwt.decode(token);

      expect(decoded.projectId).toBe('project-123');
    });

    test('生成的token应该有过期时间', () => {
      const user = { id: 1, role: 'student' };
      const token = generateToken(user);
      const decoded = jwt.decode(token);

      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });
  });

  describe('generateDownloadToken', () => {
    test('应该生成短期下载令牌', () => {
      const userId = 1;
      const filePath = '/exports/data.xlsx';

      const token = generateDownloadToken(userId, filePath);

      expect(token).toBeDefined();
      
      const decoded = jwt.decode(token);
      expect(decoded.userId).toBe(userId);
      expect(decoded.filePath).toBe(filePath);
      expect(decoded.type).toBe('download');
      expect(decoded.timestamp).toBeDefined();
    });

    test('下载令牌应该有5分钟有效期', () => {
      const token = generateDownloadToken(1, '/test.pdf');
      const decoded = jwt.decode(token);

      const expiryTime = decoded.exp - decoded.iat;
      expect(expiryTime).toBe(300); // 5分钟 = 300秒
    });
  });

  describe('authenticate middleware', () => {
    test('应该拒绝没有Authorization header的请求', async () => {
      const { authenticate } = require('../../middleware/auth');
      
      const req = {
        headers: {},
        query: {}
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('应该拒绝query参数中的token', async () => {
      const { authenticate } = require('../../middleware/auth');
      
      const req = {
        headers: {},
        query: { token: 'some-token' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
