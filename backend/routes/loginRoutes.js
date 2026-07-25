
const express = require('express');
const mongoose = require('mongoose');

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
    similarity, PDFDocument, fs, path, bcrypt, jwt, findByUsername,
    getDbConnected, setDbConnected
  } = helpers;

// login endpoint
router.post("/", async (req, res) => {
  const {
    username,
    password
  } = req.body || {};
  if (!username || !password) return res.status(400).json({
    message: 'username and password required'
  });
  let user = null;
  const isDbConnected = () => (
    typeof getDbConnected === 'function' ? getDbConnected() : mongoose.connection.readyState === 1
  );

  if (isDbConnected()) {
    // Try case-insensitive username lookup first
    const escapeRegExp = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      user = await User.findOne({
        username: {
          $regex: `^${escapeRegExp(username)}$`,
          $options: 'i'
        }
      }).lean();
    } catch (e) {
      user = await User.findOne({
        username
      }).lean().catch(() => null);
    }

    // Fallback: if not found, attempt to locate parent user by matching a student record
    // This helps when parents used their email (stored on Student) but parent User.username differs.
    if (!user) {
      try {
        const student = await Student.findOne({
          $or: [{
            email: username
          }, {
            rollNo: username
          }]
        }).lean().catch(() => null);
        if (student) {
          const candidates = await User.find({
            parentOf: {
              $in: [String(student._id), student.email, student.rollNo, student.name]
            }
          }).lean().catch(() => []);
          if (candidates && candidates.length > 0) user = candidates[0];
        }
      } catch (e) {
        // ignore fallback errors
      }
    }
    if (user) user.id = user._id;
  } else if (mongoose.connection.readyState === 1) {
    // DB is connected but dbConnected flag was false? Update it and try DB lookup.
    if (typeof setDbConnected === 'function') setDbConnected(true);
    const escapeRegExp = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      user = await User.findOne({
        username: {
          $regex: `^${escapeRegExp(username)}$`,
          $options: 'i'
        }
      }).lean();
    } catch (e) {
      user = await User.findOne({
        username
      }).lean().catch(() => null);
    }
    if (user) user.id = user._id;
  } else {
    user = findByUsername(username);
  }
  if (!user) {
    console.log(`Login failed: user ${username} not found (DB connected: ${isDbConnected()})`);
    return res.status(401).json({
      message: 'User not found'
    });
  }

  // if user record has been disabled/blocked by admin, deny access
  try {
    if (user.disabled) return res.status(403).json({
      message: 'Account blocked'
    });
  } catch (e) {
    // ignore if property missing
  }
  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    console.log(`Login failed: password mismatch for ${username}`);
    return res.status(401).json({
      message: 'Incorrect password'
    });
  }
  const payload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    name: user.name
  };
  const secret = process.env.JWT_SECRET || 'change-this-secret';
  const token = jwt.sign(payload, secret, {
    expiresIn: process.env.JWT_EXPIRES || '2h'
  });

  // frontend can decide where to redirect; we include role and a suggested redirect path
  let redirect = '/';
  if (user.role === 'admin') redirect = '/admin-dashboard';
  if (user.role === 'faculty') redirect = '/faculty-dashboard';
  if (user.role === 'student') redirect = '/student-dashboard';
  if (user.role === 'parent') redirect = '/parents-dashboard';
  if (user.role === 'staff') redirect = '/staff-dashboard';
  return res.json({
    token,
    role: user.role,
    redirect
  });
});

// register endpoint (creates user in DB if connected, otherwise in-memory)

  return router;
};
