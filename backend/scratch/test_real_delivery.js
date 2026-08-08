require('dotenv').config();
const jwt = require('jsonwebtoken');

async function testRealDelivery() {
  console.log('=== REAL STUDENT CREATION WITH LIVE RESEND DELIVERY ===');

  const secret = process.env.JWT_SECRET || 'my-super-secret-key-for-school-erp';
  const adminToken = jwt.sign(
    { sub: 'admin-test-id', username: 'admin@school.com', role: 'admin' },
    secret,
    { expiresIn: '1h' }
  );

  const studentPayload = {
    name: 'Dynamic Test Student',
    email: 'iitiancraft3@gmail.com',
    password: 'SecurePass987!',
    class: '12',
    gender: 'Female',
    medium: 'English'
  };

  console.log('Sending POST /api/students with payload:', studentPayload);

  try {
    const res = await fetch('http://localhost:4000/api/students', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(studentPayload)
    });

    const body = await res.json();
    console.log(`HTTP Status: ${res.status}`);
    console.log('Response:', JSON.stringify(body, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testRealDelivery().catch(console.error);
