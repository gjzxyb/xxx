const { body, param, query, validationResult } = require('express-validator');

/**
 * 输入验证中间件和规则
 * 使用 express-validator 进行严格的输入验证
 */

// 处理验证错误
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      code: 400,
      message: '输入验证失败',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// 学生信息验证规则
const validateStudent = [
  body('studentId')
    .trim()
    .notEmpty().withMessage('学号不能为空')
    .isLength({ min: 1, max: 50 }).withMessage('学号长度必须在1-50字符之间')
    .matches(/^[a-zA-Z0-9_-]+$/).withMessage('学号只能包含字母、数字、下划线和横线'),
  
  body('name')
    .trim()
    .notEmpty().withMessage('姓名不能为空')
    .isLength({ min: 2, max: 50 }).withMessage('姓名长度必须在2-50字符之间'),
  
  body('className')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('班级名称最多100字符'),
  
  body('password')
    .notEmpty().withMessage('密码不能为空')
    .isLength({ min: 8, max: 32 }).withMessage('密码长度必须在8-32字符之间'),
  
  handleValidationErrors
];

// 科目信息验证规则
const validateSubject = [
  body('name')
    .trim()
    .notEmpty().withMessage('科目名称不能为空')
    .isLength({ min: 1, max: 50 }).withMessage('科目名称长度必须在1-50字符之间'),
  
  body('category')
    .notEmpty().withMessage('科目类别不能为空')
    .isIn(['physics_history', 'four_electives']).withMessage('科目类别无效'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('描述最多500字符'),
  
  body('limit')
    .optional()
    .isInt({ min: 0 }).withMessage('人数限制必须是非负整数'),
  
  handleValidationErrors
];

// 项目信息验证规则
const validateProject = [
  body('projectName')
    .trim()
    .notEmpty().withMessage('项目名称不能为空')
    .isLength({ min: 2, max: 100 }).withMessage('项目名称长度必须在2-100字符之间'),
  
  body('schoolName')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('学校名称最多200字符'),
  
  handleValidationErrors
];

// 邮箱验证规则
const validateEmail = [
  body('email')
    .trim()
    .notEmpty().withMessage('邮箱不能为空')
    .isEmail().withMessage('邮箱格式不正确')
    .normalizeEmail(),
  
  handleValidationErrors
];

// ID参数验证规则
const validateId = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID必须是正整数'),
  
  handleValidationErrors
];

// 项目ID验证规则
const validateProjectId = [
  param('projectId')
    .notEmpty().withMessage('项目ID不能为空')
    .isLength({ min: 1, max: 50 }).withMessage('项目ID长度无效'),
  
  handleValidationErrors
];

// 分页参数验证
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('页码必须是正整数'),
  
  query('pageSize')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  
  handleValidationErrors
];

// 登录验证规则
const validateLogin = [
  body('studentId')
    .trim()
    .notEmpty().withMessage('学号不能为空'),
  
  body('password')
    .notEmpty().withMessage('密码不能为空'),
  
  body('projectId')
    .optional()
    .trim(),
  
  handleValidationErrors
];

// 注册验证规则
const validateRegister = [
  body('email')
    .trim()
    .notEmpty().withMessage('邮箱不能为空')
    .isEmail().withMessage('邮箱格式不正确')
    .normalizeEmail(),
  
  body('name')
    .trim()
    .notEmpty().withMessage('姓名不能为空')
    .isLength({ min: 2, max: 50 }).withMessage('姓名长度必须在2-50字符之间'),
  
  body('password')
    .notEmpty().withMessage('密码不能为空')
    .isLength({ min: 8, max: 32 }).withMessage('密码长度必须在8-32字符之间'),
  
  handleValidationErrors
];

// 批量导入验证
const validateBulkImport = [
  body('students')
    .isArray({ min: 1, max: 1000 }).withMessage('学生数据必须是数组，且最多1000条'),
  
  body('students.*.studentId')
    .trim()
    .notEmpty().withMessage('学号不能为空')
    .isLength({ min: 1, max: 50 }).withMessage('学号长度必须在1-50字符之间'),
  
  body('students.*.name')
    .trim()
    .notEmpty().withMessage('姓名不能为空')
    .isLength({ min: 2, max: 50 }).withMessage('姓名长度必须在2-50字符之间'),
  
  body('students.*.password')
    .notEmpty().withMessage('密码不能为空')
    .isLength({ min: 8, max: 32 }).withMessage('密码长度必须在8-32字符之间'),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateStudent,
  validateSubject,
  validateProject,
  validateEmail,
  validateId,
  validateProjectId,
  validatePagination,
  validateLogin,
  validateRegister,
  validateBulkImport
};
