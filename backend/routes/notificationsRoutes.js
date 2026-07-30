const prisma = require('../prisma/client');


const express = require('express');


module.exports = function(helpers) {
  const router = express.Router();
  const sseClients = new Set();
  
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

// SSE endpoint for admin notifications
router.get("/stream", (req, res) => {
  // Allow token via query param for EventSource connections: ?token=...
  const token = req.query && (req.query.token || req.query.access_token);
  try {
    const authHeader = req.headers && req.headers.authorization;
    const provided = token ? `Bearer ${token}` : authHeader;
    if (!provided) return res.status(401).json({
      message: 'Unauthorized'
    });
    const secret = process.env.JWT_SECRET || 'change-this-secret';
    let payload = null;
    try {
      const tokenOnly = provided.startsWith('Bearer ') ? provided.split(' ')[1] : provided;
      payload = jwt.verify(tokenOnly, secret);
    } catch (err) {
      return res.status(401).json({
        message: 'Invalid token'
      });
    }
    const allowed = ['admin', 'faculty'];
    if (!payload || !allowed.includes(payload.role)) return res.status(403).json({
      message: 'Forbidden'
    });
  } catch (e) {
    return res.status(401).json({
      message: 'Unauthorized'
    });
  }

  // set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();
  // add to clients
  sseClients.add(res);
  // send an initial comment to establish the stream
  res.write(`: connected\n\n`);
  req.on('close', () => {
    sseClients.delete(res);
  });
});
// Gallery image management (top-level routes)

  return router;
};
