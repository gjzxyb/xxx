// Test setting admin credentials with detailed logging
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
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function test() {
  console.log('Testing Dashboard Save Admin Credentials\n');

  try {
    // Login
    console.log('Step 1: Login...');
    const loginRes = await apiRequest('POST', '/api/platform/auth/login', {
      email: 'admin@platform.com',
      password: 'admin123'
    });

    if (loginRes.data.code !== 200) {
      console.error('✗ Login failed:', loginRes.data);
      return;
    }

    const token = loginRes.data.data.token;
    console.log('✓ Login successful\n');

    // Get or create project
    console.log('Step 2: Get/Create Project...');
    let projectsRes = await apiRequest('GET', '/api/platform/projects', null, {
      'Authorization': `Bearer ${token}`
    });

    let projectId;
    if (projectsRes.data.data && projectsRes.data.data.length > 0) {
      projectId = projectsRes.data.data[0].id;
      console.log(`✓ Using existing project: ${projectId}\n`);
    } else {
      const createRes = await apiRequest('POST', '/api/platform/projects', {
        name: 'Test Dashboard Save',
        description: 'Testing save admin credentials from dashboard'
      }, {
        'Authorization': `Bearer ${token}`
      });

      if (createRes.data.code === 200) {
        projectId = createRes.data.data.id;
        console.log(`✓ Created new project: ${projectId}\n`);
      } else {
        console.error('✗ Failed to create project:', createRes.data);
        return;
      }
    }

    // Test setting admin credentials (simulate dashboard action)
    console.log('Step 3: Set Admin Credentials (Dashboard Simulation)...');
    console.log('  Username: testadmin');
    console.log('  Password: 123456');

    const setCredsRes = await apiRequest('PUT', `/api/platform/projects/${projectId}/admin-credentials`, {
      username: 'testadmin',
      password: '123456'
    }, {
      'Authorization': `Bearer ${token}`
    });

    console.log('\n--- Response ---');
    console.log('Status:', setCredsRes.status);
    console.log('Headers:', setCredsRes.headers);
    console.log('Data:', JSON.stringify(setCredsRes.data, null, 2));

    if (setCredsRes.status === 200 && setCredsRes.data.code === 200) {
      console.log('\n✓ SUCCESS: Admin credentials set!');
      console.log(`  Username: ${setCredsRes.data.data.username}`);
    } else {
      console.log('\n✗ FAILED: Could not set credentials');
      if (typeof setCredsRes.data === 'string') {
        console.log('  Error HTML response detected');
        console.log('  First 200 chars:', setCredsRes.data.substring(0, 200));
      }
    }

  } catch (error) {
    console.error('\n✗ Test error:', error.message);
    console.error(error.stack);
  }
}

test();
