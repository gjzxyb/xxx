/**
 * 安全配置模块测试
 */

const crypto = require('crypto');

// Mock环境变量
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('Security Configuration', () => {
  describe('JWT_SECRET', () => {
    test('应该使用环境变量中的JWT_SECRET', () => {
      process.env.JWT_SECRET = 'test-secret-key';
      const { JWT_SECRET } = require('../../config/security');
      expect(JWT_SECRET).toBe('test-secret-key');
    });

    test('开发环境未设置JWT_SECRET时应生成临时密钥', () => {
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = 'development';
      
      const { JWT_SECRET } = require('../../config/security');
      
      expect(JWT_SECRET).toBeDefined();
      expect(JWT_SECRET.length).toBeGreaterThan(0);
    });

    test('生产环境未设置JWT_SECRET时应退出', () => {
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = 'production';
      
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      require('../../config/security');
      
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockError).toHaveBeenCalled();
      
      mockExit.mockRestore();
      mockError.mockRestore();
    });
  });

  describe('getJWTAccessExpiry', () => {
    test('应该返回环境变量中的值', () => {
      process.env.JWT_ACCESS_EXPIRY = '1h';
      const { getJWTAccessExpiry } = require('../../config/security');
      expect(getJWTAccessExpiry()).toBe('1h');
    });

    test('应该返回默认值2h', () => {
      delete process.env.JWT_ACCESS_EXPIRY;
      const { getJWTAccessExpiry } = require('../../config/security');
      expect(getJWTAccessExpiry()).toBe('2h');
    });
  });

  describe('getJWTRefreshExpiry', () => {
    test('应该返回环境变量中的值', () => {
      process.env.JWT_REFRESH_EXPIRY = '30d';
      const { getJWTRefreshExpiry } = require('../../config/security');
      expect(getJWTRefreshExpiry()).toBe('30d');
    });

    test('应该返回默认值7d', () => {
      delete process.env.JWT_REFRESH_EXPIRY;
      const { getJWTRefreshExpiry } = require('../../config/security');
      expect(getJWTRefreshExpiry()).toBe('7d');
    });
  });

  describe('getBcryptRounds', () => {
    test('应该返回环境变量中的数值', () => {
      process.env.BCRYPT_ROUNDS = '12';
      const { getBcryptRounds } = require('../../config/security');
      expect(getBcryptRounds()).toBe(12);
    });

    test('应该返回默认值10', () => {
      delete process.env.BCRYPT_ROUNDS;
      const { getBcryptRounds } = require('../../config/security');
      expect(getBcryptRounds()).toBe(10);
    });

    test('应该处理无效的数值', () => {
      process.env.BCRYPT_ROUNDS = 'invalid';
      const { getBcryptRounds } = require('../../config/security');
      expect(getBcryptRounds()).toBe(10);
    });
  });
});
