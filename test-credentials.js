const http = require('http');

const baseUrl = 'http://localhost:3000';
let token = '';
let projectId = '';

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
  console.log('  Testing Admin Credentials API  ');
  console.log('========================================\n');

  try {
    // Step 1: Login
    console.log('[Test 1] Login...');
    const loginRes = await apiRequest('POST', '/api/platform/auth/login', {
      email: 'admin@platform.com',
      password: 'admin123'
    });

    if (loginRes.data.code === 200) {
      token = loginRes.data.data.token;
      console.log('✓ Login successful');
      console.log(`  Token: ${token.substring(0, 20)}...`);
    } else {
      console.error('✗ Login failed:', loginRes.data.message);
      return;
    }

    // Step 2: Get projects
    console.log('\n[Test 2] Get Projects...');
    const projectsRes = await apiRequest('GET', '/api/platform/projects', null, {
      'Authorization': `Bearer ${token}`
    });

    if (projectsRes.data.code === 200) {
      const projects = projectsRes.data.data;
      console.log(`✓ Got ${projects.length} projects`);

      if (projects.length > 0) {
        projectId = projects[0].id;
        console.log(`  Using project: ${projects[0].name} (${projectId})`);
      } else {
        // Create a test project
        console.log('  No projects found, creating test project...');
        const createRes = await apiRequest('POST', '/api/platform/projects', {
          name: 'Test Credentials Project',
          description: 'For testing admin credentials'
        }, {
          'Authorization': `Bearer ${token}`
        });

        if (createRes.data.code === 200) {
          projectId = createRes.data.data.id;
          console.log(`✓ Created project: ${projectId}`);
        } else {
          console.error('✗ Failed to create project:', createRes.data.message);
          return;
        }
      }
    } else {
      console.error('✗ Get projects failed:', projectsRes.data.message);
      return;
    }

    // Step 3: Set admin credentials (THIS IS THE TEST)
    console.log('\n[Test 3] Set Admin Credentials...');
    console.log(`  Project ID: ${projectId}`);
    console.log(`  Username: testadmin`);
    console.log(`  Password: 123456`);

    const setCredsRes = await apiRequest('PUT', `/api/platform/projects/${projectId}/admin-credentials`, {
      username: 'testadmin',
      password: '123456'
    }, {
      'Authorization': `Bearer ${token}`
    });

    console.log(`\n  HTTP Status: ${setCredsRes.status}`);
    console.log(`  Response:`, JSON.stringify(setCredsRes.data, null, 2));

    if (setCredsRes.status === 200 && setCredsRes.data.code === 200) {
      console.log('\n✓ Admin credentials set successfully!');
    } else {
      console.log('\n✗ Failed to set credentials');
      console.log('  Error:', setCredsRes.data.message || setCredsRes.data);
    }

    // Step 4: Verify the admin user was created/updated
    console.log('\n[Test 4] Verify Admin User in Database...');
    console.log('  (This would require direct database query)');

  } catch (error) {
    console.error('\n✗ Test failed with error:', error.message);
    console.error(error.stack);
  }

  console.log('\n========================================');
  console.log('  Test Complete');
  console.log('========================================');
}

test();
