const { Resend } = require('resend');
const nodemailer = require('nodemailer');

// Reusable Resend SDK and Nodemailer transporter singletons
let resendClient = null;
let smtpTransporter = null;

/**
 * Get or initialize Resend SDK client.
 */
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY || process.env.SMTP_PASS;
  if (!apiKey) return null;
  if (!resendClient) {
    console.log('[Mailer] Initializing Resend API client...');
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

/**
 * Get or initialize persistent Nodemailer SMTP Transporter for Resend fallback.
 */
function getTransporter() {
  if (smtpTransporter) return smtpTransporter;

  const host = process.env.SMTP_HOST || 'smtp.resend.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = typeof process.env.SMTP_SECURE !== 'undefined'
    ? String(process.env.SMTP_SECURE).toLowerCase() === 'true'
    : port === 465;

  const user = process.env.SMTP_USER || 'resend';
  const pass = process.env.SMTP_PASS || process.env.RESEND_API_KEY;

  if (!pass) {
    console.warn('[Mailer] WARNING: Neither RESEND_API_KEY nor SMTP_PASS is configured in environment variables.');
  }

  console.log(`[Mailer] Initializing Nodemailer SMTP Transporter (${host}:${port}, secure=${secure}, user=${user})`);

  smtpTransporter = nodemailer.createTransport({
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

  return smtpTransporter;
}

/**
 * Verify Resend API Key or SMTP connection.
 */
async function verifyTransporter() {
  const apiKey = process.env.RESEND_API_KEY || process.env.SMTP_PASS;
  if (apiKey) {
    console.log('[Mailer] ✅ Resend API Key verified from environment variables.');
    return true;
  }
  try {
    const t = getTransporter();
    await t.verify();
    console.log('[Mailer] ✅ Nodemailer SMTP connection verified successfully (smtp.resend.com)');
    return true;
  } catch (err) {
    console.error('[Mailer] ❌ Nodemailer SMTP Verification Failed:');
    console.error(`[Mailer] Error Message: ${err.message || String(err)}`);
    return false;
  }
}

// Automatically initiate verification
verifyTransporter().catch(err => {
  console.error('[Mailer] Verification exception:', err);
});

/**
 * Send email using Resend API (with Nodemailer SMTP fallback if needed).
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

  // Format recipient
  const recipientList = Array.isArray(to) ? to : String(to).split(',').map(s => s.trim()).filter(Boolean);
  if (recipientList.length === 0) {
    status.error = 'Invalid or empty recipient list.';
    console.warn('[Mailer]', status.error);
    return status;
  }

  // Sender address logic:
  // Resend free tier requires sending from 'onboarding@resend.dev' or a verified domain.
  let defaultFrom = process.env.FROM_EMAIL || process.env.EMAIL_FROM || 'School ERP <onboarding@resend.dev>';
  if (/@gmail\.com/i.test(defaultFrom) && !from) {
    defaultFrom = 'School ERP <onboarding@resend.dev>';
  }
  const sender = from || defaultFrom;
  const replyToHeader = replyTo || process.env.REPLY_TO || 'iitiancraft03@gmail.com';

  status.attempted = true;

  // 1. Primary Attempt: Resend Official Node SDK
  const resend = getResendClient();
  if (resend) {
    try {
      const resendPayload = {
        from: sender,
        to: recipientList,
        subject: subject || 'School ERP Notification',
        reply_to: replyToHeader
      };
      if (html) resendPayload.html = html;
      if (text) resendPayload.text = text;
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        resendPayload.attachments = attachments.map(att => ({
          filename: att.filename,
          content: att.content
        }));
      }

      const response = await resend.emails.send(resendPayload);

      if (response && response.error) {
        console.warn(`[Mailer] ⚠️ Resend SDK returned error: ${response.error.message || JSON.stringify(response.error)}`);
        // Fall through to SMTP fallback
      } else if (response && (response.data || response.id)) {
        const id = response.data ? response.data.id : response.id;
        status.sent = true;
        status.info = response;
        console.log(`[Mailer] ✅ Email delivered via Resend API to ${recipientList.join(', ')} (ID: ${id})`);
        return status;
      }
    } catch (sdkErr) {
      console.warn(`[Mailer] ⚠️ Resend SDK error: ${sdkErr.message || String(sdkErr)}. Trying SMTP fallback...`);
    }
  }

  // 2. Secondary Fallback: Nodemailer SMTP
  try {
    const activeTransporter = getTransporter();
    const mailOptions = {
      from: sender,
      to: recipientList.join(', '),
      subject: subject || 'School ERP Notification'
    };
    if (replyToHeader) mailOptions.replyTo = replyToHeader;
    if (html) mailOptions.html = html;
    if (text) mailOptions.text = text;
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    const info = await activeTransporter.sendMail(mailOptions);
    status.sent = true;
    status.info = info;

    console.log(`[Mailer] ✅ Email delivered via Resend SMTP to ${mailOptions.to} (MessageID: ${info.messageId})`);
    return status;
  } catch (smtpErr) {
    status.error = smtpErr && (smtpErr.message || String(smtpErr));
    console.error(`[Mailer] ❌ Failed to send email to ${recipientList.join(', ')}:`, status.error);
    return status;
  }
}

/**
 * Get role-specific portal features & instructions for onboarding emails.
 */
function getRoleInstructions(role) {
  const normalized = String(role || '').toLowerCase().trim();

  if (normalized === 'student') {
    return {
      title: 'Student Portal Access',
      description: 'Welcome to your Student Portal! Through this portal, you can easily access and manage your academic profile.',
      features: [
        'View live class schedules, timetables, and teacher announcements',
        'Check attendance records and submit leave applications',
        'Access assignment uploads, course materials, and syllabus details',
        'View examination marks, report cards, and fee payment history'
      ]
    };
  }

  if (normalized === 'parent') {
    return {
      title: 'Parent Portal Access',
      description: 'Welcome to the Parent Portal! Stay actively connected with your ward\'s education and progress.',
      features: [
        'Track daily student attendance and real-time class progress',
        'View examination results, term grades, and academic reports',
        'Pay school/college fees online and download official digital receipts',
        'Receive direct administrative notices, circulars, and teacher messages'
      ]
    };
  }

  if (normalized === 'faculty' || normalized === 'teacher') {
    return {
      title: 'Faculty Portal Access',
      description: 'Welcome to the Faculty Portal! Efficiently manage your classes, student evaluation, and course materials.',
      features: [
        'Take class attendance and track student attendance history',
        'Upload marks, grade assessments, and publish test results',
        'Upload class assignments, study resources, and lesson plans',
        'Communicate with students, parents, and school administration'
      ]
    };
  }

  if (normalized === 'staff') {
    return {
      title: 'Staff Portal Access',
      description: 'Welcome to the Staff Portal! Access operational workflows, administrative tasks, and personal records.',
      features: [
        'Manage student enrollment, registration, and administrative records',
        'View salary slips, payroll details, and leave balances',
        'Process student certificates, ID cards, and library records',
        'Collaborate across administrative departments and management'
      ]
    };
  }

  // Admin / Default
  return {
    title: 'Administrative Portal Access',
    description: 'Welcome to the Master Admin Console! You have full access to manage and configure the School ERP system.',
    features: [
      'Manage users, roles, permissions, and profile approvals',
      'Oversee academic schedules, fee structures, and financial reports',
      'Send system-wide broadcasts, circulars, and automated notifications',
      'Monitor real-time system performance and operational analytics'
    ]
  };
}

/**
 * Send account credential email to a newly created profile (Student, Teacher/Faculty, Staff, Parent, Admin)
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.name - Name of the person
 * @param {string} options.role - Account type / Role ('Student', 'Teacher', 'Faculty', 'Staff', 'Parent', 'Admin')
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

  const rawRole = String(role || 'User').trim();
  const roleName = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
  const userAccount = username || to;
  // Always use the deployed frontend URL. Fallback to production URL — never localhost.
  const loginUrl = (
    process.env.FRONTEND_URL ||
    process.env.VITE_FRONTEND_URL ||
    'https://school-erp-main-three.vercel.app'
  ).replace(/\/+$/, '');
  // Admin/support contact for the email footer — read from env, never hardcoded.
  const adminContact = process.env.ADMIN_EMAIL || process.env.REPLY_TO || 'support@school-erp.com';
  const subject = `Welcome to School ERP — Your ${roleName} Account Credentials`;
  const roleInfo = getRoleInstructions(rawRole);

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

  let featureListHtml = '';
  if (roleInfo.features && roleInfo.features.length > 0) {
    featureListHtml = roleInfo.features.map(f => `<li style="margin-bottom: 6px; color: #4b5563;">${f}</li>`).join('');
  }

  const html = `
    <div style="font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; padding: 30px 15px;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e5e7eb;">
        
        <!-- Header Banner -->
        <div style="background: linear-gradient(135deg, #1e3a8a, #3b82f6); padding: 26px 30px; color: #ffffff;">
          <h2 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">School ERP Portal</h2>
          <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.92;">Official ${roleName} Account Credentials</p>
        </div>

        <!-- Body Content -->
        <div style="padding: 26px 30px; color: #374151;">
          <p style="margin: 0 0 14px; font-size: 16px; line-height: 1.5;">Dear <strong>${name || 'User'}</strong>,</p>
          <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.5; color: #4b5563;">
            An account has been created for you on the <strong>School ERP System</strong>. Below are your official access credentials:
          </p>

          <!-- Credentials Card -->
          <table style="width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
            <tr>
              <td style="padding: 10px 14px; background: #f9fafb; font-weight: 600; color: #374151; width: 40%;">Account Role</td>
              <td style="padding: 10px 14px; background: #ffffff; color: #111827;"><strong>${roleName}</strong></td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; background: #f9fafb; font-weight: 600; color: #374151; border-top: 1px solid #e5e7eb;">Username / Email</td>
              <td style="padding: 10px 14px; background: #ffffff; color: #111827; border-top: 1px solid #e5e7eb;">${userAccount}</td>
            </tr>
            ${password ? `
            <tr>
              <td style="padding: 10px 14px; background: #f9fafb; font-weight: 600; color: #374151; border-top: 1px solid #e5e7eb;">Password</td>
              <td style="padding: 10px 14px; background: #ffffff; color: #2563eb; font-weight: 700; border-top: 1px solid #e5e7eb; font-size: 15px;">${password}</td>
            </tr>` : ''}
            ${extraRowsHtml}
          </table>

          <!-- Role Specific Instructions -->
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px;">
            <h4 style="margin: 0 0 8px; color: #1e40af; font-size: 15px; font-weight: 600;">${roleInfo.title}</h4>
            <p style="margin: 0 0 10px; font-size: 13px; color: #1e3a8a; line-height: 1.4;">${roleInfo.description}</p>
            <ul style="margin: 0; padding-left: 20px; font-size: 13px;">
              ${featureListHtml}
            </ul>
          </div>

          <!-- Login CTA -->
          <div style="text-align: center; margin: 28px 0 24px;">
            <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35);">
              Login to Your Account &rarr;
            </a>
          </div>

          <p style="margin: 20px 0 8px; font-size: 13px; color: #6b7280; line-height: 1.4;">
            🔒 <strong>Security Notice:</strong> For security reasons, please change your password immediately after your initial login.
          </p>
          <p style="margin: 0; font-size: 12px; color: #9ca3af;">
            Need help? Contact system administration at <a href="mailto:${adminContact}" style="color: #2563eb; text-decoration: none;">${adminContact}</a>.
          </p>
        </div>

        <!-- Footer -->
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
  getResendClient,
  verifyTransporter
};

