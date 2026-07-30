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

// Classes management endpoints
// Basic CRUD for admin UI. Uses `Class` model to store class names and subjects.
router.get("/", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await prisma.classModel.findMany({
      orderBy: {
        name: "asc"
      }
    });
    return res.json(list);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.get("/:id", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const cls = await prisma.classModel.findUnique({
      where: {
        id: String(req.params.id)
      }
    });
    if (!cls) return res.status(404).json({
      message: 'Class not found'
    });
    return res.json(cls);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.post("/", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      name
    } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({
      message: 'name required'
    });
    const existing = await prisma.classModel.findFirst({
      where: {
        name: String(name).trim()
      }
    });
    if (existing) return res.status(409).json({
      message: 'Class already exists'
    });
    const created = await ClassModel.create({
      name: String(name).trim(),
      subjects: []
    });
    return res.status(201).json(created);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.post("/:id/subjects", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      subject
    } = req.body || {};
    if (!subject || !String(subject).trim()) return res.status(400).json({
      message: 'subject required'
    });
    const cls = await prisma.classModel.findUnique({
      where: {
        id: String(req.params.id)
      }
    });
    if (!cls) return res.status(404).json({
      message: 'Class not found'
    });
    if (!Array.isArray(cls.subjects)) cls.subjects = [];
    if (cls.subjects.includes(String(subject).trim())) return res.status(409).json({
      message: 'Subject already exists'
    });
    cls.subjects.push(String(subject).trim());
    // Transpiled save()
    if (cls && cls.id) {
      const { id: _id_unused, ..._updateData } = cls;
      await prisma.classModel.update({
        where: { id: String(cls.id) },
        data: _updateData
      });
    } else if (cls && cls._id) {
      const { _id: _id_unused2, ..._updateData2 } = cls;
      await prisma.classModel.update({
        where: { id: String(cls._id) },
        data: _updateData2
      });
    }
    return res.json(cls);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.delete("/:id/subjects/:subject", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const subjectParam = decodeURIComponent(req.params.subject || '');
    const cls = await prisma.classModel.findUnique({
      where: {
        id: String(req.params.id)
      }
    });
    if (!cls) return res.status(404).json({
      message: 'Class not found'
    });
    cls.subjects = (cls.subjects || []).filter(s => s !== subjectParam);
    // Transpiled save()
    if (cls && cls.id) {
      const { id: _id_unused, ..._updateData } = cls;
      await prisma.classModel.update({
        where: { id: String(cls.id) },
        data: _updateData
      });
    } else if (cls && cls._id) {
      const { _id: _id_unused2, ..._updateData2 } = cls;
      await prisma.classModel.update({
        where: { id: String(cls._id) },
        data: _updateData2
      });
    }
    return res.json({
      message: 'Subject removed'
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.delete("/:id", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const cls = await prisma.classModel.findUnique({
      where: {
        id: String(req.params.id)
      }
    });
    if (!cls) return res.status(404).json({
      message: 'Class not found'
    });
    await cls.deleteOne();
    return res.json({
      message: 'Class deleted'
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admit card routes are registered from `routes/admitcards.js` to avoid duplication.
// ======= Assignments and Submissions (student/faculty/admin) ========
// Provides basic assignment CRUD and student submission endpoints.

  return router;
};
