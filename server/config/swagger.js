/**
 * Swagger API 文档配置
 * 使用 swagger-jsdoc 和 swagger-ui-express 自动生成 API 文档
 */

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '学生选科系统 API',
      version: '1.0.0',
      description: '学生选科管理系统的 RESTful API 文档',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: '开发环境'
      },
      {
        url: 'https://api.example.com',
        description: '生产环境'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT 认证令牌'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            code: {
              type: 'integer',
              example: 400
            },
            message: {
              type: 'string',
              example: '操作失败'
            },
            data: {
              type: 'null'
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            code: {
              type: 'integer',
              example: 200
            },
            message: {
              type: 'string',
              example: '操作成功'
            },
            data: {
              type: 'object'
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: '用户ID'
            },
            studentId: {
              type: 'string',
              description: '学号'
            },
            name: {
              type: 'string',
              description: '姓名'
            },
            className: {
              type: 'string',
              description: '班级'
            },
            role: {
              type: 'string',
              enum: ['student', 'admin'],
              description: '角色'
            },
            phone: {
              type: 'string',
              description: '手机号'
            }
          }
        },
        Subject: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: '科目ID'
            },
            name: {
              type: 'string',
              description: '科目名称'
            },
            type: {
              type: 'string',
              enum: ['physics-history', 'elective'],
              description: '科目类型'
            },
            description: {
              type: 'string',
              description: '科目描述'
            }
          }
        },
        Selection: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: '选科记录ID'
            },
            userId: {
              type: 'integer',
              description: '用户ID'
            },
            physicsOrHistory: {
              type: 'integer',
              description: '物理或历史科目ID'
            },
            electiveOne: {
              type: 'integer',
              description: '选修科目1 ID'
            },
            electiveTwo: {
              type: 'integer',
              description: '选修科目2 ID'
            },
            status: {
              type: 'string',
              enum: ['draft', 'submitted', 'confirmed'],
              description: '选科状态'
            }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            total: {
              type: 'integer',
              description: '总记录数'
            },
            page: {
              type: 'integer',
              description: '当前页码'
            },
            limit: {
              type: 'integer',
              description: '每页条数'
            },
            totalPages: {
              type: 'integer',
              description: '总页数'
            },
            hasNext: {
              type: 'boolean',
              description: '是否有下一页'
            },
            hasPrev: {
              type: 'boolean',
              description: '是否有上一页'
            }
          }
        }
      }
    },
    tags: [
      {
        name: '认证',
        description: '用户认证相关接口'
      },
      {
        name: '科目',
        description: '科目管理相关接口'
      },
      {
        name: '选科',
        description: '选科管理相关接口'
      },
      {
        name: '管理员',
        description: '管理员功能相关接口'
      },
      {
        name: '平台',
        description: '平台管理相关接口'
      }
    ]
  },
  // API 文档源文件路径
  apis: [
    './server/routes/*.js',
    './server/models/*.js'
  ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
