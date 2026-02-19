const { success, error } = require('../../../utils/response');

describe('响应工具函数', () => {
  let res;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  describe('success', () => {
    it('应该返回成功响应（默认状态码 200）', () => {
      const data = { id: 1, name: '测试' };
      const message = '操作成功';

      success(res, data, message);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 200,
          message: message,
          data: data,
          timestamp: expect.any(String)
        })
      );
    });

    it('应该支持自定义状态码', () => {
      const data = { id: 1 };
      const message = '创建成功';

      success(res, data, message, 201);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 201,
          message: message
        })
      );
    });

    it('应该处理空数据', () => {
      success(res, null, '操作成功');

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: null
        })
      );
    });

    it('应该包含时间戳', () => {
      success(res, {}, '成功');

      const call = res.json.mock.calls[0][0];
      expect(call.timestamp).toBeDefined();
      expect(new Date(call.timestamp).toString()).not.toBe('Invalid Date');
    });
  });

  describe('error', () => {
    it('应该返回错误响应（默认状态码 400）', () => {
      const message = '请求参数错误';

      error(res, message);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 400,
          message: message,
          data: null,
          timestamp: expect.any(String)
        })
      );
    });

    it('应该支持自定义状态码', () => {
      const message = '未授权';

      error(res, message, 401);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 401,
          message: message
        })
      );
    });

    it('应该支持附加错误详情', () => {
      const message = '验证失败';
      const errors = [
        { field: 'email', message: '邮箱格式错误' },
        { field: 'password', message: '密码长度不足' }
      ];

      error(res, message, 400, errors);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: message,
          errors: errors
        })
      );
    });

    it('应该包含时间戳', () => {
      error(res, '错误');

      const call = res.json.mock.calls[0][0];
      expect(call.timestamp).toBeDefined();
      expect(new Date(call.timestamp).toString()).not.toBe('Invalid Date');
    });
  });
});
