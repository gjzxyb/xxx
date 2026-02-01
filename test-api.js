// API Automated Test Script
const http = require('http');

const baseUrl = 'http://localhost:3000';
let token = '';
let projectId = '';
const testResults = [];

// Helper function for API requests
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

// Test functions
async function testHealth() {
  console.log('\n[Test 1] Health Check...');
  try {
    const res = await apiRequest('GET', '/api/health');
    if (res.code === 200) {
      console.log('✓ Health check passed');
      testResults.push('Health Check: PASS');
      return true;
    }
  } catch (e) {
    console.log('✗ Health check failed:', e.message);
    testResults.push('Health Check: FAIL');
    return false;
  }
}

async function testLogin() {
  console.log('\n[Test 2] Login...');
  try {
    const res = await apiRequest('POST', '/api/platform/auth/login', {
      email: 'admin@platform.com',
      password: 'admin123'
    });

    if (res.code === 200 && res.data.token) {
      token = res.data.token;
      console.log('✓ Login successful');
      console.log(`  User: ${res.data.user.name}`);
      console.log(`  Email: ${res.data.user.email}`);
      console.log(`  Super Admin: ${res.data.user.isSuperAdmin}`);
      console.log(`  Max Projects: ${res.data.user.maxProjects}`);
      testResults.push('Login: PASS');
      return true;
    } else {
      console.log('✗ Login failed:', res.message);
      testResults.push('Login: FAIL');
      return false;
    }
  } catch (e) {
    console.log('✗ Login failed:', e.message);
    testResults.push('Login: FAIL');
    return false;
  }
}

async function testGetProjects() {
  console.log('\n[Test 3] Get Projects...');
  try {
    const res = await apiRequest('GET', '/api/platform/projects', null, {
      'Authorization': `Bearer ${token}`
    });

    if (res.code === 200) {
      console.log('✓ Get projects successful');
      console.log(`  Owned projects: ${res.data.owned.length}`);
      console.log(`  Collaborated projects: ${res.data.collaborated.length}`);
      testResults.push('Get Projects: PASS');

      if (res.data.owned.length > 0) {
        projectId = res.data.owned[0].id;
      }
      return res.data.owned;
    }
  } catch (e) {
    console.log('✗ Get projects failed:', e.message);
    testResults.push('Get Projects: FAIL');
    return [];
  }
}

async function testCreateProject() {
  console.log('\n[Test 4] Create Project...');
  try {
    const res = await apiRequest('POST', '/api/platform/projects', {
      name: 'Test Project',
      description: 'Created by automated test'
    }, {
      'Authorization': `Bearer ${token}`
    });

    if (res.code === 200) {
      projectId = res.data.id;
      console.log('✓ Create project successful');
      console.log(`  Project ID: ${projectId}`);
      console.log(`  Project Name: ${res.data.name}`);
      testResults.push('Create Project: PASS');
      return true;
    } else {
      console.log('✗ Create project failed:', res.message);
      testResults.push('Create Project: FAIL');
      return false;
    }
  } catch (e) {
    console.log('✗ Create project failed:', e.message);
    testResults.push('Create Project: FAIL');
    return false;
  }
}

async function testStartProject() {
  console.log('\n[Test 5] Start Project...');
  console.log(`  Project ID: ${projectId}`);
  try {
    const res = await apiRequest('POST', `/api/platform/projects/${projectId}/start`, null, {
      'Authorization': `Bearer ${token}`
    });

    if (res.code === 200) {
      console.log('✓ Start project successful');
      console.log(`  Assigned Port: ${res.data.port}`);
      console.log(`  Access URL: ${res.data.url}`);
      testResults.push('Start Project: PASS');

      // Verify status
      await new Promise(resolve => setTimeout(resolve, 1000));
      const verifyRes = await apiRequest('GET', '/api/platform/projects', null, {
        'Authorization': `Bearer ${token}`
      });

      const project = verifyRes.data.owned.find(p => p.id === projectId);
      if (project && project.status === 'running' && project.port) {
        console.log('✓ Status verification passed');
        console.log(`  Status: ${project.status}`);
        console.log(`  Port: ${project.port}`);
        testResults.push('Status Verification: PASS');
      } else {
        console.log('✗ Status verification failed');
        testResults.push('Status Verification: FAIL');
      }

      return true;
    } else {
      console.log('✗ Start project failed:', res.message);
      testResults.push('Start Project: FAIL');
      return false;
    }
  } catch (e) {
    console.log('✗ Start project failed:', e.message);
    testResults.push('Start Project: FAIL');
    return false;
  }
}

async function testStopProject() {
  console.log('\n[Test 6] Stop Project...');
  try {
    const res = await apiRequest('POST', `/api/platform/projects/${projectId}/stop`, null, {
      'Authorization': `Bearer ${token}`
    });

    if (res.code === 200) {
      console.log('✓ Stop project successful');
      testResults.push('Stop Project: PASS');

      // Verify status
      await new Promise(resolve => setTimeout(resolve, 1000));
      const verifyRes = await apiRequest('GET', '/api/platform/projects', null, {
        'Authorization': `Bearer ${token}`
      });

      const project = verifyRes.data.owned.find(p => p.id === projectId);
      if (project && project.status === 'stopped') {
        console.log('✓ Stop verification passed');
        console.log(`  Status: ${project.status}`);
        testResults.push('Stop Verification: PASS');
      } else {
        console.log('✗ Stop verification failed');
        testResults.push('Stop Verification: FAIL');
      }

      return true;
    } else {
      console.log('✗ Stop project failed:', res.message);
      testResults.push('Stop Project: FAIL');
      return false;
    }
  } catch (e) {
    console.log('✗ Stop project failed:', e.message);
    testResults.push('Stop Project: FAIL');
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('========================================');
  console.log('  Platform API Automated Tests');
  console.log('========================================');

  await testHealth();

  if (!await testLogin()) {
    console.log('\n✗ Login failed, stopping tests');
    return;
  }

  const projects = await testGetProjects();

  if (projects.length === 0) {
    await testCreateProject();
  }

  if (projectId) {
    await testStartProject();
    await testStopProject();
  }

  // Summary
  console.log('\n========================================');
  console.log('  Test Results Summary');
  console.log('========================================');
  testResults.forEach(result => {
    if (result.includes('PASS')) {
      console.log(`✓ ${result}`);
    } else {
      console.log(`✗ ${result}`);
    }
  });

  const passCount = testResults.filter(r => r.includes('PASS')).length;
  const totalCount = testResults.length;
  const passRate = ((passCount / totalCount) * 100).toFixed(2);

  console.log(`\nPass Rate: ${passRate}% (${passCount}/${totalCount})`);
  console.log('========================================\n');
}

runTests();
