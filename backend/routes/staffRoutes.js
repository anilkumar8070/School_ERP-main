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

// Staff: list staff (non-admin employees)
router.get("/", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const q = (req.query.q || '').trim();
    const base = {
      role: 'staff'
    };
    let filter = base;
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter = {
        AND: [base, {
          OR: [{
            name: { contains: q, mode: 'insensitive' }
          }, {
            username: { contains: q, mode: 'insensitive' }
          }, {
            designation: re
          }, {
            contact: { contains: q, mode: 'insensitive' }
          }, {
            fatherName: re
          }]
        }]
      };
    }
    const staff = await prisma.user.findMany({
      where: filter,

      orderBy: {
        createdAt: "desc"
      },

      select: {
        name: true,
        fatherName: true,
        username: true,
        disabled: true,
        contact: true,
        address: true,
        designation: true,
        createdAt: true
      }
    });
    return res.json(staff);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Staff: create staff (non-admin)
router.post("/", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      name,
      fatherName,
      email,
      contact,
      address,
      designation,
      password,
      gender,
      age,
      religion,
      category
    } = req.body || {};
    if (!name || !email) return res.status(400).json({
      message: 'name and email required'
    });
    let existing = await prisma.user.findFirst({
      where: {
        username: email
      }
    }).catch(() => null);
    if (existing) return res.status(409).json({
      message: 'User already exists'
    });
    const plainPassword = password && String(password).length >= 6 ? String(password) : Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 90 + 10);
    const hashed = await bcrypt.hash(plainPassword, 10);
    const created = await User.create({
      data: {
        username: email,
        password: hashed,
        role: 'staff',
        name,
        fatherName,
        contact,
        address,
        designation
      }
    });

    // send email with credentials
    try {
      const loginUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'http://localhost:5173/staff-login';
      const subject = 'You have been selected as Staff';
      const html = `
        <div style="font-family:Inter,Arial,sans-serif;background:#f3f4f6;padding:20px">
          <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
            <div style="background:linear-gradient(90deg,#06b6d4,#0ea5a4);padding:18px;color:#fff"><h2 style="margin:0">Welcome ${name}!</h2></div>
            <div style="padding:16px;color:#333">
              <p>You have been added as <strong>Staff</strong> on the ERP system. Below are your login details — keep them secure.</p>
              <table style="width:100%;border-collapse:collapse;margin-top:8px">
                <tr><td style="font-weight:700;padding:6px 0">Username</td><td style="padding:6px 0">${email}</td></tr>
                <tr><td style="font-weight:700;padding:6px 0">Password</td><td style="padding:6px 0"><strong>${plainPassword}</strong></td></tr>
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
      console.warn('Failed to send staff creation email:', mailErr && (mailErr.message || String(mailErr)));
    }
    return res.status(201).json({
      id: (created.id || created._id),
      username: created.username,
      password: plainPassword
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Staff: delete staff user
router.delete("/:id", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({
      message: 'id required'
    });
    const user = await prisma.user.findUnique({
      where: {
        id: String(id)
      }
    });
    if (!user) return res.status(404).json({
      message: 'Staff not found'
    });
    if (user.role !== 'staff') return res.status(400).json({
      message: 'Not a staff account'
    });
    await User.deleteMany({ where: {
      id: id
    } });
    return res.json({
      ok: true
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Staff: block/unblock staff
router.put("/:id/block", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
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
    const user = await prisma.user.findUnique({
      where: {
        id: String(id)
      }
    });
    if (!user) return res.status(404).json({
      message: 'Staff not found'
    });
    if (user.role !== 'staff') return res.status(400).json({
      message: 'Not a staff account'
    });
    user.disabled = !!block;
    // Transpiled save()
    if (user) {
      const { id: _unused_id, _id: _unused__id, save: _unused_save, toObject: _unused_toObject, ..._updateData } = user;
      
      // Clean out relational arrays if any to prevent Prisma crash
      for (const k in _updateData) {
        if (Array.isArray(_updateData[k]) && _updateData[k].length > 0 && typeof _updateData[k][0] === 'object') {
           delete _updateData[k];
        }
      }

      await prisma.user.update({
        where: { id: String((user.id || user._id)) },
        data: _updateData
      }).catch(e => console.error("Transpiled save error:", e.message));
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

// Staff: update staff details
router.put("/:id", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
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
    const user = await prisma.user.findUnique({
      where: {
        id: String(id)
      }
    });
    if (!user) return res.status(404).json({
      message: 'Staff not found'
    });
    if (user.role !== 'staff') return res.status(400).json({
      message: 'Not a staff account'
    });
    if (contact !== undefined) user.contact = contact;
    if (designation !== undefined) user.designation = designation;
    if (name !== undefined) user.name = name;
    if (fatherName !== undefined) user.fatherName = fatherName;
    if (address !== undefined) user.address = address;
    // Transpiled save()
    if (user) {
      const { id: _unused_id, _id: _unused__id, save: _unused_save, toObject: _unused_toObject, ..._updateData } = user;
      
      // Clean out relational arrays if any to prevent Prisma crash
      for (const k in _updateData) {
        if (Array.isArray(_updateData[k]) && _updateData[k].length > 0 && typeof _updateData[k][0] === 'object') {
           delete _updateData[k];
        }
      }

      await prisma.user.update({
        where: { id: String((user.id || user._id)) },
        data: _updateData
      }).catch(e => console.error("Transpiled save error:", e.message));
    }
    return res.json({
      ok: true,
      staff: {
        id: (user.id || user._id),
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

// HR management (admin) - expose endpoints for frontend `/api/hr` calls

  return router;
};
