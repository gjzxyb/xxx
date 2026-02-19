/**
 * 缓存服务单元测试
 */

const CacheService = require('../../lib/CacheService');

describe('CacheService 单元测试', () => {
  let cacheService;

  beforeEach(() => {
    // 使用内存模式（不依赖Redis）
    cacheService = new CacheService();
  });

  afterEach(async () => {
    // 清空缓存
    await cacheService.flush();
  });

  describe('基础缓存操作', () => {
    test('应该能设置和获取缓存', async () => {
      const key = 'test-key';
      const value = { data: 'test-value' };

      await cacheService.set(key, value, 60);
      const result = await cacheService.get(key);

      expect(result).toEqual(value);
    });

    test('应该能删除缓存', async () => {
      const key = 'test-key';
      const value = { data: 'test-value' };

      await cacheService.set(key, value, 60);
      await cacheService.del(key);
      const result = await cacheService.get(key);

      expect(result).toBeNull();
    });

    test('不存在的键应该返回null', async () => {
      const result = await cacheService.get('non-existent-key');
      expect(result).toBeNull();
    });
  });

  describe('缓存过期', () => {
    test('过期的缓存应该返回null', async () => {
      const key = 'expire-test';
      const value = { data: 'test' };

      // 设置1秒过期
      await cacheService.set(key, value, 1);

      // 等待2秒
      await new Promise(resolve => setTimeout(resolve, 2000));

      const result = await cacheService.get(key);
      expect(result).toBeNull();
    });

    test('未过期的缓存应该正常返回', async () => {
      const key = 'valid-test';
      const value = { data: 'test' };

      // 设置10秒过期
      await cacheService.set(key, value, 10);

      // 立即获取
      const result = await cacheService.get(key);
      expect(result).toEqual(value);
    });
  });

  describe('批量删除', () => {
    test('应该能使用通配符删除多个键', async () => {
      await cacheService.set('project:1:subjects:all', { data: 1 }, 60);
      await cacheService.set('project:1:subjects:physics', { data: 2 }, 60);
      await cacheService.set('project:1:stats', { data: 3 }, 60);
      await cacheService.set('project:2:subjects:all', { data: 4 }, 60);

      // 删除项目1的所有科目缓存
      const count = await cacheService.delPattern('project:1:subjects:*');

      expect(count).toBe(2);

      // 验证删除结果
      expect(await cacheService.get('project:1:subjects:all')).toBeNull();
      expect(await cacheService.get('project:1:subjects:physics')).toBeNull();
      expect(await cacheService.get('project:1:stats')).not.toBeNull();
      expect(await cacheService.get('project:2:subjects:all')).not.toBeNull();
    });
  });

  describe('缓存键生成', () => {
    test('应该生成正确的项目级缓存键', () => {
      const key = cacheService.projectKey('project-123', 'subjects:all');
      expect(key).toBe('project:project-123:subjects:all');
    });

    test('应该生成正确的平台级缓存键', () => {
      const key = cacheService.platformKey('projects:list');
      expect(key).toBe('platform:projects:list');
    });
  });

  describe('数据类型支持', () => {
    test('应该支持对象类型', async () => {
      const value = { name: '测试', count: 100, active: true };
      await cacheService.set('obj-test', value, 60);
      const result = await cacheService.get('obj-test');
      expect(result).toEqual(value);
    });

    test('应该支持数组类型', async () => {
      const value = [1, 2, 3, { name: 'test' }];
      await cacheService.set('arr-test', value, 60);
      const result = await cacheService.get('arr-test');
      expect(result).toEqual(value);
    });

    test('应该支持字符串类型', async () => {
      const value = 'test-string';
      await cacheService.set('str-test', value, 60);
      const result = await cacheService.get('str-test');
      expect(result).toBe(value);
    });

    test('应该支持数字类型', async () => {
      const value = 12345;
      await cacheService.set('num-test', value, 60);
      const result = await cacheService.get('num-test');
      expect(result).toBe(value);
    });

    test('应该支持布尔类型', async () => {
      const value = true;
      await cacheService.set('bool-test', value, 60);
      const result = await cacheService.get('bool-test');
      expect(result).toBe(value);
    });
  });

  describe('并发操作', () => {
    test('应该能处理并发写入', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(cacheService.set(`concurrent-${i}`, { value: i }, 60));
      }

      await Promise.all(promises);

      // 验证所有数据都写入成功
      for (let i = 0; i < 10; i++) {
        const result = await cacheService.get(`concurrent-${i}`);
        expect(result).toEqual({ value: i });
      }
    });

    test('应该能处理并发读取', async () => {
      await cacheService.set('concurrent-read', { data: 'test' }, 60);

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(cacheService.get('concurrent-read'));
      }

      const results = await Promise.all(promises);

      // 所有读取应该返回相同的值
      results.forEach(result => {
        expect(result).toEqual({ data: 'test' });
      });
    });
  });

  describe('错误处理', () => {
    test('设置缓存失败应该返回false', async () => {
      // 模拟错误情况（如果可能）
      const result = await cacheService.set(null, 'value', 60);
      expect(result).toBe(false);
    });

    test('获取缓存失败应该返回null', async () => {
      const result = await cacheService.get(null);
      expect(result).toBeNull();
    });
  });

  describe('清空缓存', () => {
    test('应该能清空所有缓存', async () => {
      await cacheService.set('key1', 'value1', 60);
      await cacheService.set('key2', 'value2', 60);
      await cacheService.set('key3', 'value3', 60);

      await cacheService.flush();

      expect(await cacheService.get('key1')).toBeNull();
      expect(await cacheService.get('key2')).toBeNull();
      expect(await cacheService.get('key3')).toBeNull();
    });
  });
});
