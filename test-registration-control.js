// 测试协作系统注册控制功能
const http = require('http');

const baseUrl = 'http://localhost:3000';

function apiRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function test() {
  console.log('========================================');
  console.log('  测试协作系统注册控制功能');
  console.log('========================================\n');

  try {
    // 1. 登录
    console.log('[1] 超级管理员登录...');
    const loginRes = await apiRequest('POST', '/api/platform/auth/login', {
      email: 'admin@platform.com',
      password: 'admin123'
    });

    if (loginRes.data.code !== 200) {
      console.error('✗ 登录失败:', loginRes.data);
      return;
    }

    const token = loginRes.data.data.token;
    console.log('✓ 登录成功\n');

    // 2. 获取项目列表（superadmin API）
    console.log('[2] 获取项目列表（测试是否返回registrationEnabled字段）...');
    const projectsRes = await apiRequest('GET', '/api/platform/superadmin/projects', null, {
      'Authorization': `Bearer ${token}`
    });

    if (projectsRes.status !== 200) {
      console.error('✗ 获取项目失败');
      console.error('  Status:', projectsRes.status);
      console.error('  Response:', JSON.stringify(projectsRes.data, null, 2));
      return;
    }

    if (projectsRes.data.code !== 200) {
      console.error('✗ API返回错误:', projectsRes.data.message);
      return;
    }

    const projects = projectsRes.data.data;
    console.log(`✓ 获取到 ${projects.length} 个项目\n`);

    if (projects.length === 0) {
      console.log('没有项目，创建测试项目...');
      const createRes = await apiRequest('POST', '/api/platform/projects', {
        name: 'Registration Test Project',
        description: 'Testing registration control'
      }, {
        'Authorization': `Bearer ${token}`
      });

      if (createRes.data.code === 200) {
        projects.push(createRes.data.data);
        console.log('✓ 测试项目已创建\n');
      }
    }

    // 检查第一个项目
    const project = projects[0];
    console.log('项目信息:');
    console.log('  ID:', project.id);
    console.log('  名称:', project.name);
    console.log('  状态:', project.status);
    console.log('  所有者:', project.ownerEmail || '-');
    console.log('  registrationEnabled:', project.registrationEnabled);

    if (project.registrationEnabled === undefined) {
      console.log('\n❌ 问题: registrationEnabled字段不存在！');
      console.log('   这意味着数据库还没有更新或服务器代码未生效');
    } else {
      console.log('\n✓ registrationEnabled字段存在');
    }

    // 3. 测试切换注册开关API
    console.log('\n[3] 测试切换注册开关API...');
    const currentState = project.registrationEnabled !== false;
    const newState = !currentState;

    console.log(`  当前状态: ${currentState ? '开启' : '关闭'}`);
    console.log(`  切换为: ${newState ? '开启' : '关闭'}`);

    const toggleRes = await apiRequest('PUT', `/api/platform/projects/${project.id}/registration-setting`, {
      enabled: newState
    }, {
      'Authorization': `Bearer ${token}`
    });

    console.log('\n  API响应:');
    console.log('  Status:', toggleRes.status);
    console.log('  Data:', JSON.stringify(toggleRes.data, null, 2));

    if (toggleRes.status === 200 && toggleRes.data.code === 200) {
      console.log('\n✓ API调用成功！');

      // 验证状态是否更新
      console.log('\n[4] 验证状态更新...');
      const verifyRes = await apiRequest('GET', '/api/platform/superadmin/projects', null, {
        'Authorization': `Bearer ${token}`
      });

      const updatedProject = verifyRes.data.data.find(p => p.id === project.id);
      console.log(`  更新后的registrationEnabled: ${updatedProject.registrationEnabled}`);

      if (updatedProject.registrationEnabled === newState) {
        console.log('✓ 状态更新成功！');
      } else {
        console.log('✗ 状态未正确更新');
      }
    } else {
      console.log('\n✗ API调用失败');
      if (toggleRes.status === 404) {
        console.log('  原因: API路由不存在 - 服务器可能未重启');
      }
    }

  } catch (error) {
    console.error('\n✗ 测试失败:', error.message);
    console.error(error.stack);
  }

  console.log('\n========================================');
}

test();
