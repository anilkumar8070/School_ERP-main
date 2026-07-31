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

// ===================== Online Admission APIs =====================
router.post("/", upload.single('document'), async (req, res) => {
  try {
    const payload = req.body || {};
    const required = ['studentName', 'dob', 'gender', 'address', 'parentName', 'parentPhone', 'classApplying'];
    for (const k of required) {
      if (!payload[k]) return res.status(400).json({
        message: `${k} required`
      });
    }
    const file = req.file;
    const filePath = file ? `/uploads/${file.filename}` : '';
    const doc = await OnlineAdmission.create({
      data: {
        ...payload,
        documentPath: filePath
      }
    });
    return res.status(201).json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.get("/", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await prisma.onlineAdmission.findMany({
      orderBy: {
        createdAt: "desc"
      }
    }).catch(() => []);
    return res.json(list);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// ===================== Discount Management APIs =====================

  return router;
};
