// 测试停止项目API
const fetch = require('node-fetch');

async function testStopProject() {
  try {
    // 1. 先登录平台获取token
    console.log('1. 登录平台管理...');
    const loginRes = await fetch('http://localhost:3000/api/platform/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: '1@126.com',
        password: '123123'
      })
    });
    const loginData = await loginRes.json();
    console.log('登录结果:', loginData);

    if (loginData.code !== 200) {
      console.error('登录失败');
      return;
    }

    const token = loginData.data.token;
    console.log('Token:', token.substring(0, 20) + '...');

    // 2. 获取项目列表
    console.log('\n2. 获取项目列表...');
    const projectsRes = await fetch('http://localhost:3000/api/platform/projects', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const projectsData = await projectsRes.json();
    console.log('项目列表结果:', projectsData);

    if (projectsData.code !== 200 || !projectsData.data) {
      console.error('获取项目列表失败');
      return;
    }

    const projects = projectsData.data.owned || [];
    if (projects.length === 0) {
      console.log('没有可用的项目');
      return;
    }

    const firstProject = projects[0];
    console.log('选择项目:', firstProject.name, firstProject.id);

    // 3. 测试停止项目
    console.log('\n3. 测试停止项目...');
    const stopRes = await fetch(`http://localhost:3000/api/platform/projects/${firstProject.id}/stop`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const stopData = await stopRes.json();
    console.log('停止项目结果:', stopData);
    console.log('HTTP Status:', stopRes.status);

  } catch (error) {
    console.error('测试失败:', error);
  }
}

testStopProject();
