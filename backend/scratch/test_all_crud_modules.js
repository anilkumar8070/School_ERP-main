const http = require('http');

async function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runComprehensiveAudit() {
  console.log('=== COMPREHENSIVE BACKEND CRUD AUDIT ===\n');

  // 1. Auth Login
  const loginRes = await makeRequest({
    hostname: 'localhost', port: 4000, path: '/api/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'admin', password: 'admin' });

  const token = loginRes.body?.token;
  if (!token) {
    console.error('FAILED TO LOGIN as admin:', loginRes.body);
    return;
  }
  console.log('✅ Auth Login: Success (Token acquired)');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const results = [];

  async function testModule(name, fn) {
    try {
      await fn();
      results.push({ module: name, status: 'PASS' });
      console.log(`✅ Module [${name}]: PASSED`);
    } catch (e) {
      results.push({ module: name, status: 'FAIL', error: e.message });
      console.error(`❌ Module [${name}]: FAILED - ${e.message}`);
    }
  }

  // Test 1: Students Module
  await testModule('Students CRUD', async () => {
    const getRes = await makeRequest({ hostname: 'localhost', port: 4000, path: '/api/students', method: 'GET', headers });
    if (getRes.status !== 200) throw new Error(`GET /api/students returned status ${getRes.status}`);

    const createRes = await makeRequest({ hostname: 'localhost', port: 4000, path: '/api/students', method: 'POST', headers }, {
      name: 'Temp Student QA', email: `temp.student.${Date.now()}@school.com`, class: 'Class 10', section: 'A', rollNo: String(Date.now()).slice(-4)
    });
    if (![200, 201].includes(createRes.status)) throw new Error(`POST /api/students returned status ${createRes.status}`);
    const id = createRes.body?.id || createRes.body?._id;

    if (id) {
      const updateRes = await makeRequest({ hostname: 'localhost', port: 4000, path: `/api/students/${id}`, method: 'PUT', headers }, { name: 'Temp Student QA Updated' });
      if (updateRes.status !== 200) throw new Error(`PUT /api/students/${id} returned ${updateRes.status}`);

      const delRes = await makeRequest({ hostname: 'localhost', port: 4000, path: `/api/students/${id}`, method: 'DELETE', headers });
      if (delRes.status !== 200) throw new Error(`DELETE /api/students/${id} returned ${delRes.status}`);
    }
  });

  // Test 2: Classes Module
  await testModule('Classes CRUD', async () => {
    const getRes = await makeRequest({ hostname: 'localhost', port: 4000, path: '/api/classes', method: 'GET', headers });
    if (getRes.status !== 200) throw new Error(`GET /api/classes returned status ${getRes.status}`);

    const className = `Class QA ${Date.now()}`;
    const createRes = await makeRequest({ hostname: 'localhost', port: 4000, path: '/api/classes', method: 'POST', headers }, { name: className });
    if (![200, 201].includes(createRes.status)) throw new Error(`POST /api/classes returned status ${createRes.status}`);
    const id = createRes.body?.id || createRes.body?._id;

    if (id) {
      const subRes = await makeRequest({ hostname: 'localhost', port: 4000, path: `/api/classes/${id}/subjects`, method: 'POST', headers }, { subject: 'Chemistry' });
      if (subRes.status !== 200) throw new Error(`POST /api/classes/${id}/subjects returned ${subRes.status}`);

      const delRes = await makeRequest({ hostname: 'localhost', port: 4000, path: `/api/classes/${id}`, method: 'DELETE', headers });
      if (delRes.status !== 200) throw new Error(`DELETE /api/classes/${id} returned ${delRes.status}`);
    }
  });

  // Test 3: Faculty Module
  await testModule('Faculty CRUD', async () => {
    const getRes = await makeRequest({ hostname: 'localhost', port: 4000, path: '/api/faculty', method: 'GET', headers });
    if (getRes.status !== 200) throw new Error(`GET /api/faculty returned ${getRes.status}`);

    const createRes = await makeRequest({ hostname: 'localhost', port: 4000, path: '/api/faculty', method: 'POST', headers }, {
      name: 'Dr. QA Faculty', email: `faculty.qa.${Date.now()}@school.com`, subject: 'Physics', classGrade: 'Class 10', contact: '9998887770'
    });
    if (![200, 201].includes(createRes.status)) throw new Error(`POST /api/faculty returned status ${createRes.status}`);
    const id = createRes.body?.id || createRes.body?._id;

    if (id) {
      const delRes = await makeRequest({ hostname: 'localhost', port: 4000, path: `/api/faculty/${id}`, method: 'DELETE', headers });
      if (delRes.status !== 200) throw new Error(`DELETE /api/faculty/${id} returned ${delRes.status}`);
    }
  });

  // Test 4: Notices Module
  await testModule('Notices CRUD', async () => {
    const getRes = await makeRequest({ hostname: 'localhost', port: 4000, path: '/api/notices', method: 'GET', headers });
    if (getRes.status !== 200) throw new Error(`GET /api/notices returned ${getRes.status}`);

    const createRes = await makeRequest({ hostname: 'localhost', port: 4000, path: '/api/notices', method: 'POST', headers }, {
      title: 'QA Test Notice', body: 'This is a test notice'
    });
    if (![200, 201].includes(createRes.status)) throw new Error(`POST /api/notices returned ${createRes.status}`);
    const id = createRes.body?.id || createRes.body?._id;

    if (id) {
      const delRes = await makeRequest({ hostname: 'localhost', port: 4000, path: `/api/notices/${id}`, method: 'DELETE', headers });
      if (delRes.status !== 200) throw new Error(`DELETE /api/notices/${id} returned ${delRes.status}`);
    }
  });

  // Test 5: Events Module
  await testModule('Events CRUD', async () => {
    const getRes = await makeRequest({ hostname: 'localhost', port: 4000, path: '/api/events', method: 'GET', headers });
    if (getRes.status !== 200) throw new Error(`GET /api/events returned ${getRes.status}`);

    const createRes = await makeRequest({ hostname: 'localhost', port: 4000, path: '/api/events', method: 'POST', headers }, {
      title: 'Annual Sports Day', description: 'Sports meet', date: new Date().toISOString()
    });
    if (![200, 201].includes(createRes.status)) throw new Error(`POST /api/events returned ${createRes.status}`);
  });

  // Test 6: Fee Structure Module
  await testModule('Fee Structure CRUD', async () => {
    const getRes = await makeRequest({ hostname: 'localhost', port: 4000, path: '/api/finance/fee-structure', method: 'GET', headers });
    if (getRes.status !== 200) throw new Error(`GET /api/finance/fee-structure returned ${getRes.status}`);

    const createRes = await makeRequest({ hostname: 'localhost', port: 4000, path: '/api/finance/fee-structure', method: 'POST', headers }, {
      class: 'Class 10', section: 'A', term1: 5000, term2: 5000
    });
    if (![200, 201].includes(createRes.status)) throw new Error(`POST /api/finance/fee-structure returned ${createRes.status}`);
  });

  // Test 7: Admission Enquiries Module
  await testModule('Admission Enquiries CRUD', async () => {
    const getRes = await makeRequest({ hostname: 'localhost', port: 4000, path: '/api/admission-enquiry', method: 'GET', headers });
    if (getRes.status !== 200) throw new Error(`GET /api/admission-enquiry returned ${getRes.status}`);

    const createRes = await makeRequest({ hostname: 'localhost', port: 4000, path: '/api/admission-enquiry', method: 'POST', headers }, {
      applicantName: 'Enquiry Applicant', parentName: 'Enquiry Parent', phone: '9876543210', classApplying: 'Class 10'
    });
    if (![200, 201].includes(createRes.status)) throw new Error(`POST /api/admission-enquiry returned ${createRes.status}`);
  });

  console.log('\n=== AUDIT SUMMARY ===');
  console.table(results);
}

runComprehensiveAudit();
