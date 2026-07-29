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

// register endpoint (creates user in DB if connected, otherwise in-memory)
router.post("/", async (req, res) => {
  const {
    username,
    password,
    name,
    role = 'admin'
  } = req.body || {};
  if (!username || !password) return res.status(400).json({
    message: 'username and password required'
  });

  // check existing
  // allow optional parent/profile fields during registration
  const {
    contact,
    address,
    parentOf,
    avatar
  } = req.body || {};
  if (true) {
    const exists = await User.findOne({
      username
    });
    if (exists) return res.status(409).json({
      message: 'User already exists'
    });
    const hashed = await bcrypt.hash(password, 10);
    const created = await User.create({
      username,
      password: hashed,
      role,
      name,
      contact: contact || '',
      address: address || '',
      avatar: avatar || '',
      parentOf: parentOf || []
    });
    return res.status(201).json({
      id: created._id,
      username: created.username,
      role: created.role,
      name: created.name
    });
  } else {
    const {
      findByUsername,
      addUser
    } = require('./users');
    if (findByUsername(username)) return res.status(409).json({
      message: 'User already exists'
    });
    const hashed = await bcrypt.hash(password, 10);
    const user = addUser({
      username,
      password: hashed,
      role,
      name,
      contact: contact || '',
      address: address || ''
    });
    return res.status(201).json({
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name
    });
  }
});

// logout (client-side token discard helper) - responds ok so clients can clear session

  return router;
};
