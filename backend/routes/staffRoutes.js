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
      username: email,
      password: hashed,
      role: 'staff',
      name,
      fatherName,
      contact,
      address,
      designation
    });

    // send email with credentials
    try {
      await sendCredentialEmail({
        to: email,
        name: name,
        role: 'Staff',
        username: email,
        password: plainPassword,
        extraDetails: {
          'Designation': designation || 'Staff',
          'Contact': contact || '-'
        }
      });
    } catch (mailErr) {
      console.warn('Failed to send staff creation email:', mailErr && (mailErr.message || String(mailErr)));
    }
    return res.status(201).json({
      id: created._id,
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
      staff: {
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

// HR management (admin) - expose endpoints for frontend `/api/hr` calls

  return router;
};
