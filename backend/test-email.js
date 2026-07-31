require('dotenv').config();
const nodemailer = require('nodemailer');

async function testSmtp() {
  console.log('=== RESEND SMTP TRANSPORTER AUDIT ===');
  const host = process.env.SMTP_HOST || 'smtp.resend.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = port === 465;
  const user = process.env.SMTP_USER || 'resend';
  const pass = process.env.SMTP_PASS || process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL || process.env.EMAIL_FROM || 'School ERP <onboarding@resend.dev>';
  const to = process.env.TEST_RECIPIENT || 'iitiancraft3@gmail.com';

  console.log('SMTP_HOST:', host);
  console.log('SMTP_PORT:', port, `(secure: ${secure})`);
  console.log('SMTP_USER:', user);
  console.log('SMTP_PASS present:', !!pass);
  console.log('FROM_EMAIL:', from);
  console.log('TEST_RECIPIENT:', to);

  if (!pass) {
    console.error('FATAL: Neither SMTP_PASS nor RESEND_API_KEY is present in environment variables.');
    process.exit(1);
  }

  console.log('\n--- 1. Creating Nodemailer Transporter ---');
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass
    },
    debug: true,
    logger: true
  });

  console.log('\n--- 2. Running transporter.verify() ---');
  try {
    const verified = await transporter.verify();
    console.log('✅ transporter.verify() SUCCESS:', verified);
  } catch (verifyErr) {
    console.error('❌ transporter.verify() FAILED:');
    console.error('Error Code:', verifyErr.code);
    console.error('Error Command:', verifyErr.command);
    console.error('Error Response:', verifyErr.response);
    console.error('Full Error Object:', verifyErr);
    console.error('Stack Trace:', verifyErr.stack);
    process.exit(1);
  }

  console.log('\n--- 3. Sending Test Email via Nodemailer SMTP ---');
  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject: 'Nodemailer Resend SMTP Integration Test',
      html: '<h3>Nodemailer Resend SMTP Test</h3><p>This email was sent using <b>Nodemailer + Resend SMTP (smtp.resend.com)</b>.</p>',
      text: 'This email was sent using Nodemailer + Resend SMTP (smtp.resend.com).'
    });

    console.log('✅ sendMail() SUCCESS!');
    console.log('Message ID:', info.messageId);
    console.log('Accepted:', info.accepted);
    console.log('Rejected:', info.rejected);
    console.log('Response String:', info.response);
    console.log('Full Info Object:', JSON.stringify(info, null, 2));
  } catch (sendErr) {
    console.error('❌ sendMail() FAILED:');
    console.error('Error Message:', sendErr.message);
    console.error('Error Code:', sendErr.code);
    console.error('Error Response:', sendErr.response);
    console.error('Full Error Object:', sendErr);
    console.error('Stack Trace:', sendErr.stack);
  }
}

testSmtp().catch(err => {
  console.error('Fatal execution error:', err);
});
