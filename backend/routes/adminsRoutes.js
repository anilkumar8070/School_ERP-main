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
    similarity, PDFDocument, fs, path, bcrypt, jwt, sendMail, sendCredentialEmail
  } = helpers;

// Admin: list admins
router.get("/", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
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
        AND: [base, {
          OR: [{
            name: { contains: q, mode: 'insensitive' }
          }, {
            username: { contains: q, mode: 'insensitive' }
          }, {
            designation: re
          }, {
            contact: { contains: q, mode: 'insensitive' }
          }]
        }]
      };
    }
    const admins = await prisma.user.findMany({
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
    return res.json(admins);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: create admin (admin-only)
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
      designation
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
    const generatedPassword = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 90 + 10);
    const hashed = await bcrypt.hash(generatedPassword, 10);
    const created = await User.create({
      data: {
        username: email,
        password: hashed,
        role: 'admin',
        name,
        fatherName,
        contact,
        address,
        designation
      }
    });

    // send credential email to new admin
    try {
      await sendCredentialEmail({
        to: email,
        name: name || 'Admin',
        role: 'Admin',
        username: email,
        password: generatedPassword,
        extraDetails: {
          'Father Name': fatherName || '',
          'Designation': designation || 'System Administrator',
          'Contact': contact || ''
        }
      });
    } catch (mailErr) {
      console.warn('Failed to send admin creation email:', mailErr && (mailErr.message || String(mailErr)));
    }
    return res.status(201).json({
      id: ((created.id || created._id)),
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
      message: 'Admin not found'
    });
    if (user.role !== 'admin') return res.status(400).json({
      message: 'Not an admin account'
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

// Admin: block/unblock admin
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
        where: { id: String(((user.id || user._id))) },
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

// Admin: update admin details (contact, designation)
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
        where: { id: String(((user.id || user._id))) },
        data: _updateData
      }).catch(e => console.error("Transpiled save error:", e.message));
    }
    return res.json({
      ok: true,
      admin: {
        id: ((user.id || user._id)),
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
