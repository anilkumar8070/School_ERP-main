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

async function runApiAudit() {
  console.log('--- Starting API & CRUD Audit ---');

  // 1. Login
  const loginRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'admin', password: 'admin123' });

  console.log('Login Status:', loginRes.status);
  const token = loginRes.body?.token;
  console.log('Login Token Obtained:', token ? 'YES' : 'NO');
  if (!token) {
    console.error('Login Response:', loginRes.body);
    return;
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Read Students
  const getStudents = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/students',
    method: 'GET',
    headers: authHeaders
  });
  console.log('\n[GET /api/students] Status:', getStudents.status, 'Count:', Array.isArray(getStudents.body) ? getStudents.body.length : getStudents.body);

  // 3. Create Student
  const createStudent = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/students',
    method: 'POST',
    headers: authHeaders
  }, {
    name: 'Test Student QA',
    email: 'qa.test@school.com',
    class: 'Class 10',
    section: 'A',
    rollNo: '9999',
    gender: 'Male',
    medium: 'English'
  });
  console.log('\n[POST /api/students] Status:', createStudent.status, 'Created ID:', createStudent.body?.id || createStudent.body?._id);
  const createdStudentId = createStudent.body?.id || createStudent.body?._id;

  if (createdStudentId) {
    // 4. Update Student
    const updateStudent = await makeRequest({
      hostname: 'localhost',
      port: 4000,
      path: `/api/students/${createdStudentId}`,
      method: 'PUT',
      headers: authHeaders
    }, {
      name: 'Test Student QA Updated',
      class: 'Class 10',
      section: 'B'
    });
    console.log('[PUT /api/students/:id] Status:', updateStudent.status, 'Name Updated:', updateStudent.body?.name || updateStudent.body);

    // 5. Delete Student
    const deleteStudent = await makeRequest({
      hostname: 'localhost',
      port: 4000,
      path: `/api/students/${createdStudentId}`,
      method: 'DELETE',
      headers: authHeaders
    });
    console.log('[DELETE /api/students/:id] Status:', deleteStudent.status);
  }

  // 6. Notices CRUD
  const getNotices = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/notices',
    method: 'GET',
    headers: authHeaders
  });
  console.log('\n[GET /api/notices] Status:', getNotices.status, 'Count:', Array.isArray(getNotices.body) ? getNotices.body.length : getNotices.body);

  const createNotice = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/notices',
    method: 'POST',
    headers: authHeaders
  }, {
    title: 'QA Audit Test Notice',
    body: 'This is an automated test notice created during project audit.'
  });
  console.log('[POST /api/notices] Status:', createNotice.status, 'ID:', createNotice.body?.id || createNotice.body?._id);

  // 7. Classes Read
  const getClasses = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/classes',
    method: 'GET',
    headers: authHeaders
  });
  console.log('\n[GET /api/classes] Status:', getClasses.status, 'Count:', Array.isArray(getClasses.body) ? getClasses.body.length : getClasses.body);

  // 8. Faculty Read
  const getFaculty = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/faculty',
    method: 'GET',
    headers: authHeaders
  });
  console.log('\n[GET /api/faculty] Status:', getFaculty.status, 'Count:', Array.isArray(getFaculty.body) ? getFaculty.body.length : getFaculty.body);

  console.log('\n--- API & CRUD Audit Finished ---');
}

runApiAudit().catch(err => console.error('API Audit Error:', err));
