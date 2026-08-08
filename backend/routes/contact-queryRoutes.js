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
      data: {
        name: String(name).trim(),
        email: String(email).trim(),
        contact: String(contact).trim(),
        description: String(description).trim(),
        filename: req.file && req.file.filename ? req.file.filename : undefined,
        originalname: req.file && req.file.originalname ? req.file.originalname : undefined,
        createdBy: req.user && req.user.sub ? req.user.sub : undefined
      }
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
      data: {
        name: String(name),
        email: String(email),
        contact: contact ? String(contact) : '',
        description: description ? String(description) : '',
        filename: req.file ? req.file.filename : undefined,
        originalname: req.file ? req.file.originalname : undefined
      }
    });

    // Send admin notification to iitiancraft03@gmail.com & auto-reply to user
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'iitiancraft03@gmail.com';
      await sendMail({
        to: adminEmail,
        subject: `New Contact Query: ${doc.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h3 style="color: #2563eb; margin-top: 0;">New Contact Form Query Submitted</h3>
            <p><strong>Name:</strong> ${doc.name}</p>
            <p><strong>Email:</strong> ${doc.email}</p>
            <p><strong>Contact / Phone:</strong> ${doc.contact || '-'}</p>
            <p><strong>Message / Description:</strong></p>
            <div style="background: #f9fafb; padding: 12px 16px; border-left: 4px solid #2563eb; border-radius: 4px;">
              ${(doc.description || '').replace(/\n/g, '<br/>')}
            </div>
          </div>
        `
      });

      if (doc.email) {
        await sendMail({
          to: doc.email,
          subject: `Thank you for contacting School ERP — Query Received`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
              <h3 style="color: #2563eb;">We have received your message!</h3>
              <p>Dear <strong>${doc.name}</strong>,</p>
              <p>Thank you for reaching out to the School ERP administration. We have received your query and our team will get back to you shortly.</p>
              <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">If you have urgent inquiries, please reach out to <a href="mailto:${process.env.ADMIN_EMAIL || 'iitiancraft03@gmail.com'}">${process.env.ADMIN_EMAIL || 'iitiancraft03@gmail.com'}</a>.</p>
            </div>
          `
        });
      }
    } catch (e) {
      console.warn('Failed to send contact query emails:', e.message);
    }
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
