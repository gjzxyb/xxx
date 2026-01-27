/**
 * 统一响应格式 - 便于微信小程序对接
 */

const success = (res, data = null, message = '操作成功') => {
  res.json({
    code: 200,
    message,
    data
  });
};

const error = (res, message = '操作失败', code = 400) => {
  res.status(code).json({
    code,
    message,
    data: null
  });
};

const unauthorized = (res, message = '未授权访问') => {
  res.status(401).json({
    code: 401,
    message,
    data: null
  });
};

const forbidden = (res, message = '权限不足') => {
  res.status(403).json({
    code: 403,
    message,
    data: null
  });
};

const notFound = (res, message = '资源不存在') => {
  res.status(404).json({
    code: 404,
    message,
    data: null
  });
};

module.exports = {
  success,
  error,
  unauthorized,
  forbidden,
  notFound
};
