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

// ===================== Admission Enquiry APIs =====================
router.post("/", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const payload = req.body || {};
    payload.createdBy = req.user && req.user.sub ? String(req.user.sub) : 'admin';
    payload.enquiryDate = payload.enquiryDate ? new Date(payload.enquiryDate) : new Date();
    payload.createdAt = new Date();
    const doc = await prisma.admissionEnquiry.create({ data: payload });
    return res.status(201).json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.get("/", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await prisma.admissionEnquiry.findMany({
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
router.patch("/:id", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const id = req.params.id;
    const payload = req.body || {};
    const allowed = ['status', 'notes'];
    const update = {};
    for (const k of allowed) {
      if (payload[k] !== undefined) update[k] = payload[k];
    }
    const doc = await prisma.admissionEnquiry.update({
      where: {
        id: String(id)
      },

      data: update
    }).catch(() => null);
    if (!doc) return res.status(404).json({
      message: 'not found'
    });
    return res.json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// ===================== Online Admission APIs =====================

  return router;
};
