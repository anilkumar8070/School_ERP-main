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

// Behavior records: incidents, remarks, and counseling logs
router.get("/my", verifyToken, requireRole('student'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const student = await prisma.student.findFirst({
      where: {
        email: req.user.username
      }
    }).catch(() => null);
    if (!student) return res.status(404).json({
      message: 'Student record not found'
    });
    const items = await prisma.behaviorRecord.findMany({
      where: {
        studentId: ((student.id || student._id))
      },

      orderBy: [{
        recordDate: "desc"
      }, {
        createdAt: "desc"
      }]
    });
    return res.json(items.map(mapBehaviorRecord));
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.get("/by-student/:id", verifyToken, requireRole(['parent', 'admin', 'faculty']), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const studentId = req.params.id;
    if (req.user.role === 'parent') {
      const linked = await ensureParentLinked(req.user.sub, studentId);
      if (!linked) return res.status(403).json({
        message: 'Parent is not linked to this student'
      });
    }
    const items = await prisma.behaviorRecord.findMany({
      where: {
        studentId
      },

      orderBy: [{
        recordDate: "desc"
      }, {
        createdAt: "desc"
      }]
    });
    return res.json(items.map(mapBehaviorRecord));
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.post("/", verifyToken, requireRole(['admin', 'faculty']), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      studentId,
      type,
      title,
      description = '',
      actionTaken = '',
      followUpDate = '',
      severity = 'low',
      status = 'open',
      recordDate
    } = req.body || {};
    if (!studentId || !type || !title) return res.status(400).json({
      message: 'studentId, type and title required'
    });
    const student = await prisma.student.findUnique({
      where: {
        id: String(studentId)
      }
    }).catch(() => null);
    if (!student) return res.status(404).json({
      message: 'Student not found'
    });
    const user = await prisma.user.findUnique({
      where: {
        id: String(req.user.sub)
      }
    }).catch(() => null);
    const doc = await BehaviorRecord.create({
      data: {
        studentId,
        studentName: student.name || '',
        class: student.class || '',
        section: student.section || '',
        rollNo: student.rollNo || '',
        type,
        title: String(title),
        description: String(description || ''),
        actionTaken: String(actionTaken || ''),
        followUpDate: followUpDate ? String(followUpDate) : '',
        severity: ['low', 'medium', 'high'].includes(String(severity)) ? String(severity) : 'low',
        status: ['open', 'monitoring', 'resolved'].includes(String(status)) ? String(status) : 'open',
        recordDate: recordDate ? String(recordDate) : new Date().toISOString().slice(0, 10),
        recordedBy: req.user.sub,
        recordedByName: user && user.name || req.user.username || ''
      }
    });
    return res.status(201).json(mapBehaviorRecord(doc));
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

  return router;
};
