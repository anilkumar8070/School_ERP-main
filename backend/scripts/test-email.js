require('dotenv').config();
const { sendMail, getTransporter, verifyTransporter } = require('../utils/mailer');

async function runTest() {
  console.log('====================================================');
  console.log('      ISOLATED RESEND SMTP TRANSPORTER TEST         ');
  console.log('====================================================');

  console.log('\n[Step 1] Inspecting Loaded Environment Variables:');
  console.log('  SMTP_HOST:   ', process.env.SMTP_HOST || '(default: smtp.resend.com)');
  console.log('  SMTP_PORT:   ', process.env.SMTP_PORT || '(default: 465)');
  console.log('  SMTP_SECURE: ', process.env.SMTP_SECURE || '(default: true)');
  console.log('  SMTP_USER:   ', process.env.SMTP_USER || '(default: resend)');
  console.log('  SMTP_PASS:   ', process.env.SMTP_PASS ? 'SET (hidden)' : 'MISSING');
  console.log('  RESEND_KEY:  ', process.env.RESEND_API_KEY ? 'SET (hidden)' : 'MISSING');
  console.log('  FROM_EMAIL:  ', process.env.FROM_EMAIL || process.env.EMAIL_FROM || 'School ERP <onboarding@resend.dev>');
  console.log('  REPLY_TO:    ', process.env.REPLY_TO || 'N/A');

  console.log('\n[Step 2] Verifying SMTP Connection (transporter.verify())...');
  const verified = await verifyTransporter();
  if (!verified) {
    console.error('\n❌ CRITICAL: SMTP verification failed! Stopping test.');
    process.exit(1);
  }

  console.log('\n[Step 3] Sending Test Email via Nodemailer Resend SMTP...');
  const recipient = process.argv[2] || process.env.TEST_RECIPIENT || 'iitiancraft3@gmail.com';
  console.log(`Sending to recipient: ${recipient}`);

  const result = await sendMail({
    to: recipient,
    subject: 'School ERP - Isolated Resend SMTP Test',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; background: #f4f4f7;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e1e1e1;">
          <h2 style="color: #4f46e5; margin-top: 0;">Resend SMTP Integration Verified</h2>
          <p>This email was successfully dispatched using <b>Nodemailer</b> connected to <b>Resend SMTP (smtp.resend.com)</b>.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #666;">School ERP System Automated Test</p>
        </div>
      </div>
    `
  });

  console.log('\n[Step 4] Delivery Result Analysis:');
  console.log(JSON.stringify(result, null, 2));

  if (result.sent) {
    console.log('\n✅ SUCCESS: Email successfully delivered via Resend SMTP!');
    process.exit(0);
  } else {
    console.error('\n❌ FAILURE: Could not deliver email. Error details printed above.');
    process.exit(1);
  }
}

runTest().catch(err => {
  console.error('Unhandled script failure:', err);
  process.exit(1);
});
