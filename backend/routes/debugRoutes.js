const prisma = require('../prisma/client');


const express = require('express');


module.exports = function(helpers) {
  const router = express.Router();
  
  const { 
    User, Complaint, Event, Syllabus, Leave, Message, Student, Faculty,
    ContactQuery, DeletionRequest, Meeting, FeeStructure, Receipt, ReportCard,
    Assignment, Submission, Timetable, FacultyRegistration, StudentRegistration,
    PasswordReset, Attendance, FacultyAttendance, StaffAttendance, Mark, Notice,
    Resource, TestSeries, ClassModel, TestResult, Question, SalaryPayment,
    StaffSalaryPayment, IDCard, HostelAllocation, Hostel, FrontOffice,
    AdmissionEnquiry, OnlineAdmission, Discount, LessonPlan, BehaviorRecord,
    CustomForm, FormQuery, Gallery, Certificate, NotificationSettings,
    TransportAllocation, TransportReceipt, ReceiptModel,
    verifyToken, requireRole, generateReceiptPdf, generateReportCardPdf,
    generateAdmitCardPdf, generateIDCardPdf, generateHostelReceiptPdf,
    generateSalaryReceiptPdf, upload, transporter, generateCertificatePdf,
    similarity, PDFDocument, fs, path, bcrypt, jwt
  } = helpers;

// Debug: test mail endpoint (useful to verify mail delivery on host).
// If `DEBUG_MAIL_TOKEN` is set in env, the request must include header `X-Debug-Token: <token>`.
// WARNING: Keep this endpoint protected or remove it after testing in production.

// Protected debug endpoint to check SendGrid API and SMTP connectivity from the host.
// Requires header `X-Debug-Token: <DEBUG_MAIL_TOKEN>` when `DEBUG_MAIL_TOKEN` is set in env.
router.post("/send-test-mail", async (req, res) => {
  try {
    const debugToken = process.env.DEBUG_MAIL_TOKEN || '';
    if (debugToken) {
      const provided = req.get('X-Debug-Token') || '';
      if (provided !== debugToken) return res.status(403).json({
        message: 'Forbidden'
      });
    }
    const {
      to,
      subject,
      html,
      text
    } = req.body || {};
    const toAddr = (to || process.env.TEST_MAIL_TO || '').trim();
    if (!toAddr) return res.status(400).json({
      message: 'to (or TEST_MAIL_TO env) required'
    });
    const mailStatus = await sendMail({
      to: toAddr,
      subject: subject || 'Test email from ERP',
      html: html || '<p>This is a test email from your ERP instance.</p>',
      text
    });
    return res.json({
      ok: true,
      mailStatus
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.post("/sendgrid-check", async (req, res) => {
  try {
    const debugToken = process.env.DEBUG_MAIL_TOKEN || '';
    if (debugToken) {
      const provided = req.get('X-Debug-Token') || '';
      if (provided !== debugToken) return res.status(403).json({
        message: 'Forbidden'
      });
    }
    const result = {
      webApi: null,
      smtp: null
    };

    // Check SendGrid Web API reachability
    try {
      if (!process.env.SENDGRID_API_KEY) {
        result.webApi = {
          ok: false,
          error: 'SENDGRID_API_KEY not set'
        };
      } else {
        const https = require('https');
        result.webApi = {
          ok: false
        };
        await new Promise(resolve => {
          const opts = {
            hostname: 'api.sendgrid.com',
            port: 443,
            path: '/v3/user/account',
            method: 'GET',
            headers: {
              Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`
            },
            timeout: 10000
          };
          const r = https.request(opts, resp => {
            let data = '';
            resp.on('data', c => {
              data += c;
            });
            resp.on('end', () => {
              result.webApi.statusCode = resp.statusCode;
              try {
                result.webApi.body = JSON.parse(data);
              } catch (e) {
                result.webApi.body = data;
              }
              result.webApi.ok = resp.statusCode >= 200 && resp.statusCode < 300;
              resolve();
            });
          });
          r.on('error', e => {
            result.webApi.error = String(e);
            resolve();
          });
          r.on('timeout', () => {
            result.webApi.error = 'timeout';
            r.destroy();
            resolve();
          });
          r.end();
        });
      }
    } catch (e) {
      result.webApi = {
        ok: false,
        error: e && (e.message || String(e)),
        stack: e && e.stack
      };
    }

    // Check SMTP connectivity using nodemailer.verify (if SMTP config present)
    try {
      if (!process.env.SMTP_HOST || !process.env.SMTP_PORT) {
        result.smtp = {
          ok: false,
          error: 'SMTP_HOST/SMTP_PORT not set'
        };
      } else {
        const nodemailer = require('nodemailer');
        const smtpOptions = {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
          auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          } : undefined,
          tls: {
            rejectUnauthorized: false
          }
        };
        const transporter = nodemailer.createTransport(smtpOptions);
        result.smtp = {
          ok: false
        };
        try {
          const info = await transporter.verify();
          result.smtp.ok = true;
          result.smtp.info = info || null;
        } catch (e) {
          result.smtp.ok = false;
          result.smtp.error = e && (e.message || String(e));
          result.smtp.stack = e && e.stack;
        }
      }
    } catch (e) {
      result.smtp = {
        ok: false,
        error: e && (e.message || String(e)),
        stack: e && e.stack
      };
    }
    return res.json({
      ok: true,
      result
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message,
      stack: e.stack
    });
  }
});
// Debug: report whether Razorpay env vars are present (development helper - does not return secrets)
router.get("/razorpay", (req, res) => {
  try {
    const keyIdPresent = !!process.env.RAZORPAY_KEY_ID;
    const keySecretPresent = !!process.env.RAZORPAY_KEY_SECRET;
    return res.json({
      ok: true,
      configured: keyIdPresent && keySecretPresent,
      keyIdPresent,
      keySecretPresent
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      message: e.message
    });
  }
});

// Assign a fee to students in a class/section (admin)

  return router;
};
