const nodemailer = require('nodemailer');

// Reusable Nodemailer transporter singleton
let transporter = null;
let isVerified = false;

/**
 * Get or initialize persistent Nodemailer SMTP Transporter for Resend.
 */
function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || 'smtp.resend.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = typeof process.env.SMTP_SECURE !== 'undefined'
    ? String(process.env.SMTP_SECURE).toLowerCase() === 'true'
    : port === 465;

  const user = process.env.SMTP_USER || 'resend';
  const pass = process.env.SMTP_PASS || process.env.RESEND_API_KEY;

  if (!pass) {
    console.warn('[Mailer] WARNING: Neither SMTP_PASS nor RESEND_API_KEY is configured in environment variables.');
  }

  console.log(`[Mailer] Initializing Nodemailer SMTP Transporter (${host}:${port}, secure=${secure}, user=${user})`);

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    }
  });

  return transporter;
}

/**
 * Verify SMTP connection & credentials on startup/first call.
 */
async function verifyTransporter() {
  try {
    const t = getTransporter();
    const result = await t.verify();
    isVerified = true;
    console.log('[Mailer] ✅ Nodemailer SMTP connection verified successfully (smtp.resend.com)');
    return true;
  } catch (err) {
    isVerified = false;
    console.error('[Mailer] ❌ Nodemailer SMTP Verification Failed:');
    console.error(`[Mailer] Error Code: ${err.code || 'N/A'}`);
    console.error(`[Mailer] Error Message: ${err.message || String(err)}`);
    if (err.response) console.error(`[Mailer] SMTP Response: ${err.response}`);
    if (err.stack) console.error(`[Mailer] Stack Trace:\n${err.stack}`);
    return false;
  }
}

// Automatically initiate verification
verifyTransporter().catch(err => {
  console.error('[Mailer] Verification exception:', err);
});

/**
 * Send email using persistent Nodemailer Resend SMTP transporter.
 * @param {Object} options
 * @param {string|string[]} options.to - Recipient email address(es)
 * @param {string} options.subject - Email subject line
 * @param {string} [options.html] - HTML body
 * @param {string} [options.text] - Text body
 * @param {string} [options.from] - Custom sender address
 * @param {string} [options.replyTo] - Reply-to header
 * @param {Array<{filename: string, content: Buffer|string}>} [options.attachments] - Attachments array
 * @returns {Promise<{attempted: boolean, sent: boolean, info: Object|null, error: string|null}>}
 */
async function sendMail({
  to,
  subject,
  html,
  text,
  from,
  replyTo,
  attachments
}) {
  const status = {
    attempted: false,
    sent: false,
    info: null,
    error: null
  };

  if (!to) {
    status.error = 'No recipient address (to) specified.';
    console.warn('[Mailer]', status.error);
    return status;
  }

  const activeTransporter = getTransporter();
  let defaultFrom = process.env.FROM_EMAIL || process.env.EMAIL_FROM || 'School ERP <onboarding@resend.dev>';
  // Resend SMTP requires a verified domain or onboarding@resend.dev for FROM address.
  // If configured FROM email is an unverified gmail address, fall back to onboarding@resend.dev with REPLY-TO set to college email.
  if (/@gmail\.com/i.test(defaultFrom) && !from) {
    defaultFrom = 'School ERP <onboarding@resend.dev>';
  }
  const sender = from || defaultFrom;
  const replyToHeader = replyTo || process.env.REPLY_TO || 'iitiancraft3@gmail.com';

  const mailOptions = {
    from: sender,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject: subject || 'School ERP Notification'
  };


  if (replyToHeader) mailOptions.replyTo = replyToHeader;
  if (html) mailOptions.html = html;
  if (text) mailOptions.text = text;
  if (attachments && Array.isArray(attachments) && attachments.length > 0) {
    mailOptions.attachments = attachments;
  }

  status.attempted = true;

  try {
    const info = await activeTransporter.sendMail(mailOptions);
    status.sent = true;
    status.info = info;

    console.log(`[Mailer] ✅ Email delivered via Resend SMTP to ${mailOptions.to}`);
    console.log(`[Mailer] Message ID: ${info.messageId}`);
    console.log(`[Mailer] Accepted: ${JSON.stringify(info.accepted)}`);
    console.log(`[Mailer] SMTP Response: ${info.response}`);

    return status;
  } catch (err) {
    status.error = err && (err.message || String(err));
    console.error(`[Mailer] ❌ Failed to send email to ${mailOptions.to}:`);
    console.error(`[Mailer] Error Code: ${err.code || 'N/A'}`);
    console.error(`[Mailer] Error Command: ${err.command || 'N/A'}`);
    if (err.response) console.error(`[Mailer] SMTP Response: ${err.response}`);
    if (err.responseCode) console.error(`[Mailer] Response Code: ${err.responseCode}`);
    if (err.stack) console.error(`[Mailer] Stack Trace:\n${err.stack}`);

    return status;
  }
}

/**
 * Send account credential email to a newly created profile (Student, Teacher, Staff, Parent)
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.name - Name of the person
 * @param {string} options.role - Account type / Role ('Student', 'Teacher', 'Staff', 'Parent')
 * @param {string} [options.username] - Username / login email (defaults to `to`)
 * @param {string} options.password - Generated or assigned password
 * @param {Object} [options.extraDetails] - Additional key-value details (e.g. Class, Section, Roll No, Employee ID, Designation)
 * @returns {Promise<{attempted: boolean, sent: boolean, info: Object|null, error: string|null}>}
 */
async function sendCredentialEmail({
  to,
  name,
  role,
  username,
  password,
  extraDetails = {}
}) {
  if (!to) {
    console.warn('[Mailer] Cannot send credential email: No recipient email specified.');
    return { attempted: false, sent: false, info: null, error: 'No recipient email specified.' };
  }

  const roleName = String(role || 'Account').charAt(0).toUpperCase() + String(role || 'Account').slice(1);
  const userAccount = username || to;
  const loginUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'http://localhost:5173';
  const subject = `Welcome to School ERP — Your ${roleName} Account Credentials`;

  let extraRowsHtml = '';
  for (const [key, value] of Object.entries(extraDetails)) {
    if (value !== undefined && value !== null && value !== '') {
      extraRowsHtml += `
            <tr>
              <td style="padding: 10px 14px; background: #f9fafb; font-weight: 600; color: #374151; border-top: 1px solid #e5e7eb; width: 40%;">${key}</td>
              <td style="padding: 10px 14px; background: #ffffff; color: #111827; border-top: 1px solid #e5e7eb;">${value}</td>
            </tr>`;
    }
  }

  const html = `
    <div style="font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; padding: 30px 15px;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e5e7eb;">
        <div style="background: linear-gradient(135deg, #4f46e5, #06b6d4); padding: 24px 28px; color: #ffffff;">
          <h2 style="margin: 0; font-size: 22px; font-weight: 700;">Welcome to School ERP</h2>
          <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.95;">Your ${roleName} account has been created successfully</p>
        </div>
        <div style="padding: 24px 28px; color: #374151;">
          <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">Dear <strong>${name || 'User'}</strong>,</p>
          <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.5; color: #4b5563;">
            An account has been registered for you on our School ERP platform. Below are your official account credentials to access the system:
          </p>

          <table style="width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
            <tr>
              <td style="padding: 10px 14px; background: #f9fafb; font-weight: 600; color: #374151; width: 40%;">Account Type</td>
              <td style="padding: 10px 14px; background: #ffffff; color: #111827;"><strong>${roleName}</strong></td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; background: #f9fafb; font-weight: 600; color: #374151; border-top: 1px solid #e5e7eb;">Username / Email</td>
              <td style="padding: 10px 14px; background: #ffffff; color: #111827; border-top: 1px solid #e5e7eb;">${userAccount}</td>
            </tr>
            ${password ? `
            <tr>
              <td style="padding: 10px 14px; background: #f9fafb; font-weight: 600; color: #374151; border-top: 1px solid #e5e7eb;">Password</td>
              <td style="padding: 10px 14px; background: #ffffff; color: #4f46e5; font-weight: 700; border-top: 1px solid #e5e7eb; font-size: 15px;">${password}</td>
            </tr>` : ''}
            ${extraRowsHtml}
          </table>

          <div style="text-align: center; margin: 28px 0 20px;">
            <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5, #06b6d4); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 6px rgba(79, 70, 229, 0.3);">
              Login to School ERP
            </a>
          </div>

          <p style="margin: 20px 0 8px; font-size: 13px; color: #6b7280; line-height: 1.4;">
            🔒 <strong>Important:</strong> For security reasons, please change your password after logging in for the first time.
          </p>
          <p style="margin: 0; font-size: 12px; color: #9ca3af;">
            If you did not expect this email or need assistance, please contact the administration.
          </p>
        </div>
        <div style="background: #f9fafb; padding: 14px 28px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280;">
          School ERP System &bull; College Administration
        </div>
      </div>
    </div>
  `;

  try {
    const result = await sendMail({
      to,
      subject,
      html
    });

    if (result.sent) {
      console.log(`[Mailer] ✅ Credential email sent successfully to ${to} (${roleName})`);
    } else {
      console.warn(`[Mailer] ⚠️ Failed to send credential email to ${to}: ${result.error}`);
    }
    return result;
  } catch (err) {
    const errorMsg = err && (err.message || String(err));
    console.error(`[Mailer] ❌ Error in sendCredentialEmail for ${to}:`, errorMsg);
    return { attempted: true, sent: false, info: null, error: errorMsg };
  }
}

module.exports = {
  sendMail,
  sendCredentialEmail,
  getTransporter,
  verifyTransporter
};

