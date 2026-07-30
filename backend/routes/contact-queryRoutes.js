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

// Contact Query endpoints (moved after multer/upload initialization)
// Public: submit a contact query (optionally attach a PDF under the configured upload limits)

// Admin: list contact queries

// Admin: update status and optionally add a note and mark notified

// Admin: update faculty fields (accept assignments, houses, role)

// Faculty dashboard - small summary for faculty (used by frontend to populate panel)

// Faculty Attendance APIs

// CSV export for faculty attendance

// Student deletion requests (admin): list and approve

// Create a report card (admin/faculty)

// List all report cards (admin)

// List report cards for current user (student)

// Parent/Admin/Student: list report cards for a specific student

// Student/Parent/Admin: rank summary for one student within class-section

// Download report card file

// Staff Attendance APIs

// CSV export for staff attendance

// Hostel Allocation APIs
// List allocations (optionally filter by studentId or hostelId)

// Create allocation

// Mark an allocation as paid (creates a receipt)

// Receipts: list my receipts

// Hostel receipts: list my hostel receipts (separate from generic receipts list)

// Admin: backfill/complete missing hostel receipts (populate rollNo/class/pdfUrl where possible)

// Delete all allocations (admin-only)

// Hostel CRUD APIs
// List all hostels

// Student: view my hostel allocations

// Public: minimal hostel list (no auth) for student display

// Create a hostel

// Update a hostel

// Delete a hostel
router.post("/", upload.single('attachment'), async (req, res) => {
  try {
    const {
      name,
      email,
      contact,
      description
    } = req.body || {};
    if (!name || !email || !contact || !description) return res.status(400).json({
      message: 'name, email, contact and description are required'
    });
    if ((description || '').length > 10000) return res.status(400).json({
      message: 'description too long'
    });
    const doc = await ContactQuery.create({
      name: String(name).trim(),
      email: String(email).trim(),
      contact: String(contact).trim(),
      description: String(description).trim(),
      filename: req.file && req.file.filename ? req.file.filename : undefined,
      originalname: req.file && req.file.originalname ? req.file.originalname : undefined,
      createdBy: req.user && req.user.sub ? req.user.sub : undefined
    });

    // Return saved object
    return res.json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
// Public: submit a contact query (from Start page contact button)
router.post("/", upload.single('attachment'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      name,
      email,
      contact,
      description
    } = req.body || {};
    if (!name || !email) return res.status(400).json({
      message: 'name and email required'
    });
    const doc = await ContactQuery.create({
      name: String(name),
      email: String(email),
      contact: contact ? String(contact) : '',
      description: description ? String(description) : '',
      filename: req.file ? req.file.filename : undefined,
      originalname: req.file ? req.file.originalname : undefined
    });

    // Try to notify admin email about new contact (best-effort)
    try {
      const adminEmail = process.env.FROM_EMAIL || process.env.SMTP_USER;
      if (adminEmail) {
        await sendMail({
          to: adminEmail,
          subject: `New contact query from ${doc.name}`,
          html: `<p><strong>Name:</strong> ${doc.name}</p><p><strong>Email:</strong> ${doc.email}</p><p><strong>Contact:</strong> ${doc.contact || '-'} </p><p><strong>Description:</strong><br/>${(doc.description || '').replace(/\n/g, '<br/>')}</p>`
        }).catch(() => null);
      }
    } catch (e) {/* ignore notification errors */}
    return res.status(201).json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: list submitted contact queries

  return router;
};
