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

// Complaints
router.post("/", verifyToken, async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  const {
    text,
    priority
  } = req.body || {};
  if (!text) return res.status(400).json({
    message: 'text required'
  });
  try {
    const c = await Complaint.create({
      userId: req.user.sub,
      username: req.user.username,
      text,
      priority
    });
    return res.status(201).json(c);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.get("/", verifyToken, async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    if (req.user.role === 'admin') {
      const all = await prisma.complaint.findMany({
        orderBy: {
          createdAt: "desc"
        }
      });
      return res.json(all);
    }
    const mine = await prisma.complaint.findMany({
      where: {
        userId: req.user.sub
      },

      orderBy: {
        createdAt: "desc"
      }
    });
    return res.json(mine);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.put("/:id/status", verifyToken, requireRole('admin'), async (req, res) => {
  const {
    status,
    note
  } = req.body || {};
  if (!status) return res.status(400).json({
    message: 'status required'
  });
  try {
    const c = await prisma.complaint.findUnique({
      where: {
        id: String(req.params.id)
      }
    });
    if (!c) return res.status(404).json({
      message: 'Complaint not found'
    });
    // push history entry
    // Prefer storing the user's display name when available, fallback to username or id
    const displayBy = req.user.name || req.user.username || req.user.sub;
    const entry = {
      by: displayBy,
      role: req.user.role || 'admin',
      note: note || '',
      status,
      at: new Date()
    };
    c.status = status;
    c.history = c.history || [];
    c.history.push(entry);
    const saved = c; // Transpiled save()
    if (c && c.id) {
      const { id: _id_unused, ..._updateData } = c;
      await prisma.complaint.update({
        where: { id: String(c.id) },
        data: _updateData
      });
    } else if (c && c._id) {
      const { _id: _id_unused2, ..._updateData2 } = c;
      await prisma.complaint.update({
        where: { id: String(c._id) },
        data: _updateData2
      });
    }
    return res.json(saved);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Events

  return router;
};
