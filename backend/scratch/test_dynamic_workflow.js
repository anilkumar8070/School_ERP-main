require('dotenv').config();
const jwt = require('jsonwebtoken');

async function testRealStudentCreationWorkflow() {
  console.log('=== REAL APPLICATION WORKFLOW: ADMIN STUDENT CREATION ===');

  const secret = process.env.JWT_SECRET || 'my-super-secret-key-for-school-erp';
  const adminToken = jwt.sign(
    { sub: 'admin-test-id', username: 'admin@school.com', role: 'admin' },
    secret,
    { expiresIn: '1h' }
  );

  console.log('\n--- 1. Admin UI Submission for Student "Levity" ---');
  const levityPayload = {
    name: 'Levity',
    email: 'levitylegend1@gmail.com',
    password: 'levity123',
    class: '10',
    gender: 'Male',
    medium: 'English'
  };

  console.log('Posting form data to HTTP POST http://localhost:4000/api/students...');
  console.log('Payload sent:', JSON.stringify(levityPayload, null, 2));

  try {
    const res1 = await fetch('http://localhost:4000/api/students', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(levityPayload)
    });

    const body1 = await res1.json();
    console.log(`HTTP Status: ${res1.status}`);
    console.log('API Response:', JSON.stringify(body1, null, 2));

    if (res1.ok || res1.status === 201) {
      console.log('✅ Student "Levity" created successfully via POST /api/students!');
    } else {
      console.warn('⚠️ Response message:', body1.message);
    }
  } catch (err) {
    console.error('❌ Failed HTTP request:', err.message);
  }

  console.log('\n--- 2. Admin UI Submission for Second Student "Rahul" ---');
  const rahulPayload = {
    name: 'Rahul',
    email: 'rahul.demo.test@example.com',
    password: 'rahul456password',
    class: '9',
    gender: 'Male',
    medium: 'English'
  };

  console.log('Posting form data to HTTP POST http://localhost:4000/api/students...');
  console.log('Payload sent:', JSON.stringify(rahulPayload, null, 2));

  try {
    const res2 = await fetch('http://localhost:4000/api/students', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(rahulPayload)
    });

    const body2 = await res2.json();
    console.log(`HTTP Status: ${res2.status}`);
    console.log('API Response:', JSON.stringify(body2, null, 2));

    if (res2.ok || res2.status === 201) {
      console.log('✅ Student "Rahul" created successfully via POST /api/students!');
    } else {
      console.warn('⚠️ Response message:', body2.message);
    }
  } catch (err) {
    console.error('❌ Failed HTTP request:', err.message);
  }

  console.log('\n=== REAL WORKFLOW TEST COMPLETED ===');
}

testRealStudentCreationWorkflow().catch(console.error);
