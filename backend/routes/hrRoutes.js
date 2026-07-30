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

// HR management (admin) - expose endpoints for frontend `/api/hr` calls
router.get("/", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const q = (req.query.q || '').trim();
    const base = {
      role: 'staff',
      hr: true
    };
    let filter = base;
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter = {
        $and: [base, {
          OR: [{
            name: re
          }, {
            username: re
          }, {
            designation: re
          }, {
            contact: re
          }, {
            fatherName: re
          }]
        }]
      };
    }
    const list = await prisma.user.findMany({
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
        gender: true,
        age: true,
        religion: true,
        category: true,
        createdAt: true
      }
    });
    return res.json(list);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
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
    const doc = await User.create({
      username: email,
      password: hashed,
      role: 'staff',
      hr: true,
      name,
      fatherName,
      contact,
      address,
      designation,
      gender: gender || '',
      age: age !== undefined && age !== '' && age !== null ? Number(age) : null,
      religion: religion || '',
      category: category || ''
    });

    // Send welcome email with credentials (best-effort)
    try {
      const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || '';
      const loginLink = frontendUrl ? `${frontendUrl}/staff-login` : `${process.env.FRONTEND_DIST ? process.env.FRONTEND_DIST : ''}`;
      const subject = 'Welcome — You have been added as HR';
      const html = `<p>Hello ${String(name || '')},</p>
        <p>Congratulations — you have been added as an HR user in the ERP system.</p>
        <p>Your login credentials are:</p>
        <ul>
          <li>Username: <strong>${doc.username}</strong></li>
          <li>Password: <strong>${plainPassword}</strong></li>
        </ul>
        <p>You can login at: <a href="${loginLink}">${loginLink}</a></p>
        <p>Please change your password after your first login.</p>
        <p>Regards,<br/>Admin</p>`;
      sendMail({
        to: doc.username,
        subject,
        html
      }).catch(() => {});
    } catch (e) {/* ignore mail errors */}
    return res.status(201).json({
      ok: true,
      id: doc._id,
      username: doc.username,
      password: plainPassword
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
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
      message: 'HR not found'
    });
    if (user.role !== 'staff' || !user.hr) return res.status(400).json({
      message: 'Not an HR account'
    });
    await prisma.user.delete({
      where: {
        id: String(id)
      }
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
      message: 'HR not found'
    });
    if (user.role !== 'staff' || !user.hr) return res.status(400).json({
      message: 'Not an HR account'
    });
    user.disabled = !!block;
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
    return res.json({
      ok: true
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
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
      address
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
      message: 'HR not found'
    });
    if (user.role !== 'staff' || !user.hr) return res.status(400).json({
      message: 'Not an HR account'
    });
    if (contact !== undefined) user.contact = contact;
    if (designation !== undefined) user.designation = designation;
    if (name !== undefined) user.name = name;
    if (fatherName !== undefined) user.fatherName = fatherName;
    if (address !== undefined) user.address = address;
    if (gender !== undefined) user.gender = gender;
    if (age !== undefined) user.age = age === '' || age === null ? null : Number(age);
    if (religion !== undefined) user.religion = religion;
    if (category !== undefined) user.category = category;
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
    return res.json({
      ok: true,
      hr: {
        id: user._id,
        name: user.name,
        fatherName: user.fatherName,
        username: user.username,
        contact: user.contact,
        designation: user.designation,
        address: user.address,
        gender: user.gender || '',
        age: user.age || '',
        religion: user.religion || '',
        category: user.category || ''
      }
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: list parents

  return router;
};
