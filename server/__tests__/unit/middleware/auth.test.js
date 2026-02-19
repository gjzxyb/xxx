const jwt = require('jsonwebtoken');
const { authenticateProject, generateToken } = require('../../../middleware/auth');

describe('认证中间件', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      user: null,
      projectId: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('authenticateProject', () => {
    it('应该验证有效的 JWT Token', () => {
      const token = jwt.sign(
        { userId: 1, projectId: 'test-project', role: 'student' },
        process.env.JWT_SECRET || 'test-secret'
      );

      req.headers.authorization = `Bearer ${token}`;

      authenticateProject(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe(1);
      expect(req.projectId).toBe('test-project');
      expect(next).toHaveBeenCalled();
    });

    it('应该拒绝缺少 Token 的请求', () => {
      authenticateProject(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 401,
          message: expect.stringContaining('Token')
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('应该拒绝无效的 Token', () => {
      req.headers.authorization = 'Bearer invalid-token';

      authenticateProject(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('应该拒绝过期的 Token', () => {
      const expiredToken = jwt.sign(
        { userId: 1, projectId: 'test-project', role: 'student' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' }
      );

      req.headers.authorization = `Bearer ${expiredToken}`;

      authenticateProject(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('应该拒绝格式错误的 Authorization 头', () => {
      req.headers.authorization = 'InvalidFormat token';

      authenticateProject(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('generateToken', () => {
    it('应该生成有效的 JWT Token', () => {
      const payload = {
        userId: 1,
        projectId: 'test-project',
        role: 'student'
      };

      const token = generateToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.projectId).toBe(payload.projectId);
      expect(decoded.role).toBe(payload.role);
    });

    it('应该包含过期时间', () => {
      const payload = { userId: 1, projectId: 'test-project' };
      const token = generateToken(payload);

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
    });
  });
});
