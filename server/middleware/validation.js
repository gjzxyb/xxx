/**
 * 统一输入验证中间件
 * 使用 express-validator 进行数据验证
 */
const { body, param, query, validationResult } = require('express-validator');

/**
 * 处理验证结果的中间件
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      code: 400,
      message: '输入验证失败',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

/**
 * 用户登录验证规则
 */
const validateLogin = [
  body('studentId')
    .trim()
    .notEmpty().withMessage('学号不能为空')
    .isLength({ min: 1, max: 20 }).withMessage('学号长度必须在1-20个字符之间'),
  body('password')
    .notEmpty().withMessage('密码不能为空')
    .isLength({ min: 1, max: 50 }).withMessage('密码长度不能超过50个字符'),
  handleValidationErrors
];

/**
 * 用户注册/导入验证规则
 */
const validateUserCreate = [
  body('studentId')
    .trim()
    .notEmpty().withMessage('学号不能为空')
    .isLength({ min: 1, max: 20 }).withMessage('学号长度必须在1-20个字符之间')
    .matches(/^[a-zA-Z0-9_-]+$/).withMessage('学号只能包含字母、数字、下划线和连字符'),
  body('name')
    .trim()
    .notEmpty().withMessage('姓名不能为空')
    .isLength({ min: 1, max: 50 }).withMessage('姓名长度必须在1-50个字符之间'),
  body('password')
    .optional({ checkFalsy: true })
    .isLength({ min: 6, max: 50 }).withMessage('密码长度必须在6-50个字符之间'),
  body('className')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('班级名称不能超过50个字符'),
  body('phone')
    .optional()
    .trim()
    .matches(/^1[3-9]\d{9}$/).withMessage('手机号格式不正确'),
  body('role')
    .optional()
    .isIn(['student', 'admin']).withMessage('角色必须是student或admin'),
  handleValidationErrors
];

/**
 * 批量导入学生验证规则
 */
const validateStudentsImport = [
  body('students')
    .isArray({ min: 1 }).withMessage('学生列表不能为空')
    .custom((students) => {
      if (students.length > 1000) {
        throw new Error('单次最多导入1000条记录');
      }
      return true;
    }),
  body('students.*.studentId')
    .trim()
    .notEmpty().withMessage('学号不能为空')
    .isLength({ min: 1, max: 20 }).withMessage('学号长度必须在1-20个字符之间'),
  body('students.*.name')
    .trim()
    .notEmpty().withMessage('姓名不能为空')
    .isLength({ min: 1, max: 50 }).withMessage('姓名长度必须在1-50个字符之间'),
  handleValidationErrors
];

/**
 * 选科提交验证规则
 */
const validateSelectionSubmit = [
  body('physicsOrHistory')
    .notEmpty().withMessage('必须选择物理或历史')
    .isInt().withMessage('科目ID必须是整数'),
  body('electiveOne')
    .notEmpty().withMessage('必须选择第一门选修科目')
    .isInt().withMessage('科目ID必须是整数'),
  body('electiveTwo')
    .notEmpty().withMessage('必须选择第二门选修科目')
    .isInt().withMessage('科目ID必须是整数')
    .custom((value, { req }) => {
      if (value === req.body.electiveOne) {
        throw new Error('两门选修科目不能相同');
      }
      return true;
    }),
  handleValidationErrors
];

/**
 * ID参数验证
 */
const validateIdParam = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID必须是正整数'),
  handleValidationErrors
];

/**
 * 分页参数验证
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('页码必须是正整数')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('每页条数必须在1-100之间')
    .toInt(),
  handleValidationErrors
];

/**
 * 时间设置验证规则
 */
const validateTimeSettings = [
  body('startTime')
    .notEmpty().withMessage('开始时间不能为空')
    .isISO8601().withMessage('开始时间格式不正确')
    .toDate(),
  body('endTime')
    .notEmpty().withMessage('结束时间不能为空')
    .isISO8601().withMessage('结束时间格式不正确')
    .toDate()
    .custom((endTime, { req }) => {
      if (new Date(endTime) <= new Date(req.body.startTime)) {
        throw new Error('结束时间必须晚于开始时间');
      }
      return true;
    }),
  handleValidationErrors
];

/**
 * 科目创建/更新验证规则
 */
const validateSubject = [
  body('name')
    .trim()
    .notEmpty().withMessage('科目名称不能为空')
    .isLength({ min: 1, max: 50 }).withMessage('科目名称长度必须在1-50个字符之间'),
  body('type')
    .notEmpty().withMessage('科目类型不能为空')
    .isIn(['physics-history', 'elective']).withMessage('科目类型必须是physics-history或elective'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('科目描述不能超过500个字符'),
  handleValidationErrors
];

/**
 * 项目ID验证（用于多租户）
 */
const validateProjectId = [
  query('projectId')
    .optional()
    .trim()
    .notEmpty().withMessage('项目ID不能为空')
    .isLength({ min: 1, max: 100 }).withMessage('项目ID长度不合法'),
  handleValidationErrors
];

/**
 * 密码修改验证规则
 */
const validatePasswordChange = [
  body('oldPassword')
    .notEmpty().withMessage('旧密码不能为空'),
  body('newPassword')
    .notEmpty().withMessage('新密码不能为空')
    .isLength({ min: 6, max: 50 }).withMessage('新密码长度必须在6-50个字符之间')
    .custom((newPassword, { req }) => {
      if (newPassword === req.body.oldPassword) {
        throw new Error('新密码不能与旧密码相同');
      }
      return true;
    }),
  handleValidationErrors
];

module.exports = {
  // 工具函数
  handleValidationErrors,
  
  // 验证规则
  validateLogin,
  validateUserCreate,
  validateStudentsImport,
  validateSelectionSubmit,
  validateIdParam,
  validatePagination,
  validateTimeSettings,
  validateSubject,
  validateProjectId,
  validatePasswordChange
};
