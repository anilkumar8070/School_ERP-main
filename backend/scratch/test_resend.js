require('dotenv').config();
const { sendMail, getResendClient } = require('../utils/mailer');

async function testResend() {
  console.log('--- Testing Resend Email Utility ---');
  console.log('RESEND_API_KEY present:', !!process.env.RESEND_API_KEY);
  console.log('EMAIL_FROM:', process.env.EMAIL_FROM);

  const resendClient = getResendClient();
  if (!resendClient) {
    console.error('Failed to get Resend client!');
    process.exit(1);
  }

  // Attempt to send test email to user's test address or onboarding address
  const testRecipient = process.env.TEST_EMAIL || 'iitiancraft3@gmail.com';
  console.log(`Sending test email to ${testRecipient}...`);

  const result = await sendMail({
    to: testRecipient,
    subject: 'School ERP - Resend Integration Test',
    html: '<h2>Resend Email Test Successful</h2><p>This email confirms that Resend integration is working properly in the School ERP backend.</p>'
  });

  console.log('Result:', JSON.stringify(result, null, 2));

  if (result.sent) {
    console.log('✅ Test email sent successfully!');
  } else {
    console.log('⚠️ Email sending result details above.');
  }
}

testResend().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
