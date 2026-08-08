require('dotenv').config();
const { sendMail, sendCredentialEmail } = require('./utils/mailer');

async function testResendIntegration() {
  console.log('=== GLOBAL RESEND EMAIL INTEGRATION TEST ===');
  const recipient = process.env.TEST_RECIPIENT || 'iitiancraft3@gmail.com';
  console.log(`Target Recipient: ${recipient}`);

  console.log('\n--- Test 1: Generic Email Notification via Resend ---');
  const test1 = await sendMail({
    to: recipient,
    subject: 'School ERP — Resend Integration Test',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2563eb;">School ERP Resend Test</h2>
        <p>This email confirms that the global Resend email service is working properly.</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      </div>
    `
  });
  console.log('Test 1 Result:', JSON.stringify(test1, null, 2));

  console.log('\n--- Test 2: Role-Based Student Credential Email via Resend ---');
  const test2 = await sendCredentialEmail({
    to: recipient,
    name: 'Test Student',
    role: 'Student',
    username: 'student@example.com',
    password: 'TempPassword123!',
    extraDetails: {
      'Class': '10',
      'Section': 'A',
      'Roll Number': '1001'
    }
  });
  console.log('Test 2 Result:', JSON.stringify(test2, null, 2));

  console.log('\n=== TEST SUITE COMPLETED ===');
}

testResendIntegration().catch(err => {
  console.error('Fatal execution error:', err);
});

