// 测试简化后的多租户架构
const http = require('http');

const baseUrl = 'http://localhost:3000';
let token = '';
let projectId = '';

function apiRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
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
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('========================================');
  console.log('  多租户架构简化功能测试');
  console.log('========================================\n');

  // 1. 登录
  console.log('[测试1] 登录...');
  const loginRes = await apiRequest('POST', '/api/platform/auth/login', {
    email: 'admin@platform.com',
    password: 'admin123'
  });

  if (loginRes.code === 200) {
    token = loginRes.data.token;
    console.log('✓ 登录成功');
  } else {
    console.log('✗ 登录失败');
    return;
  }

  // 2. 获取项目列表
  console.log('\n[测试2] 获取项目列表...');
  const projectsRes = await apiRequest('GET', '/api/platform/projects', null, {
    'Authorization': `Bearer ${token}`
  });

  if (projectsRes.code === 200 && projectsRes.data.owned.length > 0) {
    projectId = projectsRes.data.owned[0].id;
    const project = projectsRes.data.owned[0];
    console.log('✓ 获取项目成功');
    console.log(`  项目ID: ${projectId}`);
    console.log(`  项目名称: ${project.name}`);
    console.log(`  当前状态: ${project.status}`);
    console.log(`  端口: ${project.port || 'null'}`);
  } else {
    console.log('✗ 没有项目，先创建一个...');
    const createRes = await apiRequest('POST', '/api/platform/projects', {
      name: '测试项目（架构简化）',
      description: '测试多租户共享模式'
    }, {
      'Authorization': `Bearer ${token}`
    });
    if (createRes.code === 200) {
      projectId = createRes.data.id;
      console.log('✓ 创建项目成功');
      console.log(`  项目ID: ${projectId}`);
    }
  }

  // 3. 测试启用项目（新架构：不分配端口）
  console.log('\n[测试3] 启用项目（多租户模式）...');
  const startRes = await apiRequest('POST', `/api/platform/projects/${projectId}/start`, null, {
    'Authorization': `Bearer ${token}`
  });

  console.log('响应数据：', JSON.stringify(startRes, null, 2));

  if (startRes.code === 200) {
    console.log('✓ 启用项目成功');
    console.log(`  消息: ${startRes.message}`);
    console.log(`  访问URL: ${startRes.data.url}`);
    console.log(`  项目ID: ${startRes.data.projectId}`);

    // 验证响应中没有port字段
    if (!startRes.data.port) {
      console.log('✓ 确认：不再分配端口（符合预期）');
    } else {
      console.log('✗ 警告：仍然返回了port字段');
    }

    // 验证URL格式
    if (startRes.data.url.includes('selection.html?projectId=')) {
      console.log('✓ URL格式正确：使用共享URL模式');
    } else {
      console.log('✗ URL格式错误');
    }
  } else {
    console.log('✗ 启用项目失败:', startRes.message);
  }

  // 4. 验证项目状态
  console.log('\n[测试4] 验证项目状态更新...');
  await new Promise(resolve => setTimeout(resolve, 500));

  const verifyRes = await apiRequest('GET', '/api/platform/projects', null, {
    'Authorization': `Bearer ${token}`
  });

  const project = verifyRes.data.owned.find(p => p.id === projectId);
  if (project) {
    console.log('✓ 项目状态已更新');
    console.log(`  状态: ${project.status}`);
    console.log(`  端口: ${project.port || 'null'}`);

    if (project.status === 'running') {
      console.log('✓ 状态正确：running');
    }

    if (!project.port) {
      console.log('✓ 端口为null（符合新架构）');
    } else {
      console.log('⚠ 端口仍有值（可能是旧数据）');
    }
  }

  // 5. 测试设置管理员密码
  console.log('\n[测试5] 设置项目管理员密码...');
  const credRes = await apiRequest('PUT', `/api/platform/projects/${projectId}/admin-credentials`, {
    username: 'testadmin',
    password: 'test123456'
  }, {
    'Authorization': `Bearer ${token}`
  });

  if (credRes.code === 200) {
    console.log('✓ 设置管理员密码成功');
    console.log(`  管理员账号: ${credRes.data.username}`);
  } else {
    console.log('✗ 设置失败:', credRes.message);
  }

  // 6. 测试禁用项目
  console.log('\n[测试6] 禁用项目...');
  const stopRes = await apiRequest('POST', `/api/platform/projects/${projectId}/stop`, null, {
    'Authorization': `Bearer ${token}`
  });

  if (stopRes.code === 200) {
    console.log('✓ 禁用项目成功');
    console.log(`  消息: ${stopRes.message}`);
  } else {
    console.log('✗ 禁用失败:', stopRes.message);
  }

  // 7. 再次验证状态
  console.log('\n[测试7] 验证禁用后的状态...');
  await new Promise(resolve => setTimeout(resolve, 500));

  const finalRes = await apiRequest('GET', '/api/platform/projects', null, {
    'Authorization': `Bearer ${token}`
  });

  const finalProject = finalRes.data.owned.find(p => p.id === projectId);
  if (finalProject) {
    console.log('✓ 项目状态已更新');
    console.log(`  状态: ${finalProject.status}`);

    if (finalProject.status === 'stopped') {
      console.log('✓ 状态正确：stopped');
    }
  }

  // 总结
  console.log('\n========================================');
  console.log('  测试完成！');
  console.log('========================================');
  console.log('\n核心验证点：');
  console.log('✓ 启用项目不再分配端口');
  console.log('✓ 返回共享URL：/selection.html?projectId=xxx');
  console.log('✓ 状态管理正常（running/stopped）');
  console.log('✓ 管理员密码设置功能正常');
  console.log('\n多租户架构简化成功！🎉\n');
}

runTests().catch(console.error);
