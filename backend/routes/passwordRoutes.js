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

// Password reset: request reset (creates token, emails user)
router.post("/forgot", async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      email
    } = req.body || {};
    if (!email) return res.status(400).json({
      message: 'email required'
    });
    const user = await prisma.user.findFirst({
      where: {
        username: email
      }
    });
    if (!user) return res.status(404).json({
      message: 'No account found with that email'
    });

    // generate token
    const crypto = require('crypto');
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // remove existing tokens for user
    await PasswordReset.deleteMany({
      userId: user._id
    }).catch(() => {});
    await PasswordReset.create({
      userId: user._id,
      token,
      expiresAt
    });

    // send email with reset link
    try {
      const frontendBase = (process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || `http://localhost:${process.env.FRONTEND_PORT || 5173}`).replace(/\/+$/g, '');
      const resetUrl = `${frontendBase}/reset-password?token=${token}`;
      const subject = 'Password reset request';
      const html = `
        <div style="font-family:Arial,sans-serif;background:#f3f4f6;padding:20px;">
          <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
            <div style="background:linear-gradient(90deg,#f59e0b,#ef4444);padding:16px;color:white"><h2 style="margin:0">Password Reset</h2></div>
            <div style="padding:16px;color:#333"><p>Hi ${user.name || user.username},</p>
              <p>We received a request to reset your password. Click the button below to reset it. This link expires in 1 hour.</p>
              <p style="text-align:left;margin-top:12px"><a href="${resetUrl}" style="display:inline-block;padding:10px 14px;background:linear-gradient(90deg,#7c3aed,#06b6d4);color:#fff;border-radius:8px;text-decoration:none">Reset Password</a></p>
              <p style="margin-top:12px;color:#666;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
            </div>
          </div>
        </div>
      `;
      await sendMail({
        to: user.username,
        subject,
        html
      });
    } catch (mailErr) {
      console.warn('Failed to send password reset email:', mailErr && (mailErr.message || String(mailErr)));
    }
    return res.json({
      ok: true
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Password reset: apply new password
router.post("/reset", async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      token,
      password
    } = req.body || {};
    if (!token || !password) return res.status(400).json({
      message: 'token and password required'
    });
    const pr = await prisma.passwordReset.findFirst({
      where: {
        token
      }
    });
    if (!pr) return res.status(400).json({
      message: 'Invalid or expired token'
    });
    if (new Date() > pr.expiresAt) {
      await PasswordReset.deleteOne({
        _id: pr._id
      }).catch(() => {});
      return res.status(400).json({
        message: 'Token expired'
      });
    }
    const user = await prisma.user.findUnique({
      where: {
        id: String(pr.userId)
      }
    });
    if (!user) return res.status(404).json({
      message: 'User not found'
    });
    const hashed = await bcrypt.hash(password, 10);
    user.password = hashed;
    // Transpiled save()
    if (user && user.id) {
      const { id: _id_unused, ..._updateData } = user;
      await prisma.user.update({
        where: { id: String(user.id) },
        data: _updateData
      });
    } else if (user && user._id) {
      const { _id: _id_unused2, ..._updateData2 } = user;
      await prisma.user.update({
        where: { id: String(user._id) },
        data: _updateData2
      });
    }

    // cleanup tokens
    await PasswordReset.deleteMany({
      userId: user._id
    }).catch(() => {});

    // send confirmation email
    try {
      const subject = 'Your password has been changed';
      const html = `
        <div style="font-family:Arial,sans-serif;background:#f3f4f6;padding:20px;">
          <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
            <div style="background:linear-gradient(90deg,#06b6d4,#7c3aed);padding:16px;color:white"><h2 style="margin:0">Password Changed</h2></div>
            <div style="padding:16px;color:#333"><p>Hi ${user.name || user.username},</p>
              <p>Your account password was successfully changed. If you did not perform this action, contact the administrator immediately.</p>
            </div>
          </div>
        </div>
      `;
      await sendMail({
        to: user.username,
        subject,
        html
      });
    } catch (mailErr) {
      console.warn('Failed to send password-changed email:', mailErr && (mailErr.message || String(mailErr)));
    }
    return res.json({
      ok: true
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Finance endpoints

  return router;
};
