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

// Hostel CRUD APIs
// List all hostels
router.get("/", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await prisma.Hostel.findMany().sort({
      createdAt: -1
    }).catch(() => []);
    return res.json(list);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Student: view my hostel allocations

// Public: minimal hostel list (no auth) for student display
router.get("/public", async (req, res) => {
  try {
    const list = await Hostel.find({}, {
      name: 1,
      floors: 1
    }).sort({
      createdAt: -1
    }).catch(() => []);
    return res.json(list);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Create a hostel
router.post("/", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      name,
      floors,
      address,
      capacity,
      amenities,
      warden,
      contact
    } = req.body || {};
    if (!name) return res.status(400).json({
      message: 'name required'
    });
    const doc = await Hostel.create({
      name: String(name).trim(),
      floors: Array.isArray(floors) ? floors : [],
      address: address || '',
      capacity: Number(capacity || 0),
      amenities: Array.isArray(amenities) ? amenities : [],
      warden: warden || '',
      contact: contact || ''
    });
    return res.status(201).json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Update a hostel
router.put("/:id", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const payload = req.body || {};
    const doc = await Hostel.findByIdAndUpdate(id, payload, {
      new: true
    }).catch(() => null);
    if (!doc) return res.status(404).json({
      message: 'Hostel not found'
    });
    return res.json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Delete a hostel
router.delete("/:id", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const doc = await prisma.hostel.delete({ where: { id: String(id) } }).catch(() => null);
    if (!doc) return res.status(404).json({
      message: 'Hostel not found'
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

// try to require mammoth for docx parsing; optional dependency

  return router;
};
