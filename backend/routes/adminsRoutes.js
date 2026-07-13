
const express = require('express');
const mongoose = require('mongoose');

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

// Admin: list admins
router.get("/", verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const q = (req.query.q || '').trim();
    const base = {
      role: 'admin'
    };
    let filter = base;
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter = {
        $and: [base, {
          $or: [{
            name: re
          }, {
            username: re
          }, {
            designation: re
          }, {
            contact: re
          }]
        }]
      };
    }
    const admins = await User.find(filter).select('name fatherName username disabled contact address designation createdAt').sort({
      createdAt: -1
    }).lean();
    return res.json(admins);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: create admin (admin-only)
router.post("/", verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      name,
      fatherName,
      email,
      contact,
      address,
      designation
    } = req.body || {};
    if (!name || !email) return res.status(400).json({
      message: 'name and email required'
    });
    let existing = await User.findOne({
      username: email
    }).lean().catch(() => null);
    if (existing) return res.status(409).json({
      message: 'User already exists'
    });
    const generatedPassword = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 90 + 10);
    const hashed = await bcrypt.hash(generatedPassword, 10);
    const created = await User.create({
      username: email,
      password: hashed,
      role: 'admin',
      name,
      fatherName,
      contact,
      address,
      designation
    });

    // send email with credentials
    try {
      const loginUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || '';
      const subject = 'You have been selected as Staff';
      const html = `
        <div style="font-family:Inter,Arial,sans-serif;background:#f3f4f6;padding:20px">
          <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
            <div style="background:linear-gradient(90deg,#06b6d4,#0ea5a4);padding:18px;color:#fff"><h2 style="margin:0">Welcome ${name}!</h2></div>
            <div style="padding:16px;color:#333">
              <p>You have been added as <strong>Staff</strong> on the ERP system with administrative access. Below are your login details — keep them secure.</p>
              <table style="width:100%;border-collapse:collapse;margin-top:8px">
                <tr><td style="font-weight:700;padding:6px 0">Username</td><td style="padding:6px 0">${email}</td></tr>
                <tr><td style="font-weight:700;padding:6px 0">Password</td><td style="padding:6px 0"><strong>${generatedPassword}</strong></td></tr>
                ${fatherName ? `<tr><td style="font-weight:700;padding:6px 0">Father Name</td><td style="padding:6px 0">${fatherName}</td></tr>` : ''}
                <tr><td style="font-weight:700;padding:6px 0">Designation</td><td style="padding:6px 0">${designation || '-'}</td></tr>
                <tr><td style="font-weight:700;padding:6px 0">Contact</td><td style="padding:6px 0">${contact || '-'}</td></tr>
              </table>
              <p style="margin-top:12px"><a href="${loginUrl}" style="display:inline-block;padding:10px 14px;background:linear-gradient(90deg,#7c3aed,#06b6d4);color:#fff;border-radius:8px;text-decoration:none">Login to ERP</a></p>
            </div>
          </div>
        </div>
      `;
      await sendMail({
        to: email,
        subject,
        html
      });
    } catch (mailErr) {
      console.warn('Failed to send admin creation email:', mailErr && (mailErr.message || String(mailErr)));
    }
    return res.status(201).json({
      id: created._id,
      username: created.username
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: delete admin user
router.delete("/:id", verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({
      message: 'id required'
    });
    const user = await User.findById(id);
    if (!user) return res.status(404).json({
      message: 'Admin not found'
    });
    if (user.role !== 'admin') return res.status(400).json({
      message: 'Not an admin account'
    });
    await User.deleteOne({
      _id: id
    });
    return res.json({
      ok: true
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: block/unblock admin
router.put("/:id/block", verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const id = req.params.id;
    const {
      block
    } = req.body || {};
    if (!id) return res.status(400).json({
      message: 'id required'
    });
    const user = await User.findById(id);
    if (!user) return res.status(404).json({
      message: 'Admin not found'
    });
    if (user.role !== 'admin') return res.status(400).json({
      message: 'Not an admin account'
    });
    // Prevent blocking the currently authenticated admin (main admin)
    if (String(req.user.sub) === String(id)) return res.status(400).json({
      message: 'Cannot block the main admin'
    });
    user.disabled = !!block;
    await user.save();
    return res.json({
      ok: true
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: update admin details (contact, designation)
router.put("/:id", verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const id = req.params.id;
    const {
      contact,
      designation,
      name,
      fatherName,
      address,
      gender,
      age,
      religion,
      category
    } = req.body || {};
    if (!id) return res.status(400).json({
      message: 'id required'
    });
    const user = await User.findById(id);
    if (!user) return res.status(404).json({
      message: 'Admin not found'
    });
    if (user.role !== 'admin') return res.status(400).json({
      message: 'Not an admin account'
    });

    // For safety, only allow updating these fields
    if (contact !== undefined) user.contact = contact;
    if (designation !== undefined) user.designation = designation;
    if (name !== undefined) user.name = name;
    if (fatherName !== undefined) user.fatherName = fatherName;
    if (address !== undefined) user.address = address;
    await user.save();
    return res.json({
      ok: true,
      admin: {
        id: user._id,
        name: user.name,
        fatherName: user.fatherName,
        username: user.username,
        contact: user.contact,
        designation: user.designation,
        address: user.address
      }
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Staff: list staff (non-admin employees)

  return router;
};
