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

// Basic health

// Resolve current user's Faculty record

// login endpoint

// register endpoint (creates user in DB if connected, otherwise in-memory)

// logout (client-side token discard helper) - responds ok so clients can clear session

// Salary payment APIs (admin and faculty)
// ===================== Faculty Salary APIs =====================
// List all faculty (minimal fields)

// Create a salary payment (mock Razorpay flow). If Razorpay env exists, we still mock success for test.

// Create Razorpay order (optional real test). Returns order payload for Checkout.

// Capture/verify payment and persist receipt. Frontend sends order/payment ids.

// List all salary payments (admin)

// Faculty: my salary payments

// Generate simple HTML receipt for a salary payment (downloadable via browser)

// PDF receipt (application/pdf). Requires pdfkit installed; otherwise returns 501.

// ===================== Staff Salary APIs (admin) =====================
// List all staff users (minimal fields)

// Create a staff salary payment (mock Razorpay flow)

// Generate a pending staff salary slip for tracking before payment

// Mark an existing staff salary slip as paid

// Create Razorpay order for staff salary

// Confirm staff salary payment and persist receipt

// List all staff salary payments

// Staff: my staff salary payments

// Generate HTML receipt for staff salary payment (admin or owning staff)

// Staff/Admin: PDF receipt for staff salary payment

// Faculty registration endpoint (public) - stores registration for admin approval

// Student registration (public) -> admin approval

// Admin: list student registrations

// Faculty/Admin: list students by class/section

// NOTE: Student route consolidated earlier. Removed duplicate handler to avoid
// multiple handlers for the same path which can produce unexpected behavior.

// Student: get or generate parent access code for the logged-in student

// Attendance endpoints

// Export student attendance history as CSV

// Faculty attendance endpoints

// Export faculty attendance history as CSV

// Marks endpoints (basic create/update/list)

// Bulk upsert marks: accepts array of marks

// Return marks for the logged-in student (or parent with studentId query)

// Faculty: lesson planning management
router.get("/", (req, res) => res.json({
  ok: true,
  true: true
}));

  return router;
};
