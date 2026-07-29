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

// protected profile
router.get("/", verifyToken, async (req, res) => {
  try {
    // try to return a DB-backed user profile when possible
    const uid = req.user && req.user.sub;
    if (!uid) return res.json({
      user: req.user
    });
    const user = await prisma.user.findUnique({ where: { id: String(uid) } }).catch(() => null);
    if (!user) return res.json({
      user: req.user
    });

    // try to attach student/faculty records when available
    let student = null;
    let faculty = null;
    try {
      student = await prisma.student.findUnique({ where: { id: String(uid) } }).catch(() => null);
    } catch (e) {
      student = null;
    }
    try {
      faculty = await Faculty.findOne({
        email: user.username
      }).catch(() => null);
      if (!faculty && user.name) faculty = await Faculty.findOne({
        name: user.name
      }).catch(() => null);
      if (!faculty && user.contact) faculty = await Faculty.findOne({
        contact: user.contact
      }).catch(() => null);
    } catch (e) {
      faculty = null;
    }
    return res.json({
      user,
      student,
      faculty
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Update profile: updates User fields and tries to sync Student/Faculty when possible
router.put("/", verifyToken, async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const uid = req.user && req.user.sub;
    if (!uid) return res.status(400).json({
      message: 'User id missing'
    });
    const payload = req.body || {};
    // Only allow a subset of fields
    const allowed = ['name', 'contact', 'address', 'avatar', 'email'];
    const up = {};
    for (const k of allowed) if (payload[k] !== undefined) up[k] = payload[k];
    const updatedUser = await User.findByIdAndUpdate(uid, up, {
      new: true
    }).catch(() => null);

    // try to update student/faculty records if present
    let updatedStudent = null;
    let updatedFaculty = null;
    try {
      let s = await prisma.student.findUnique({ where: { id: String(uid) } }).catch(() => null);
      if (s) {
        const su = {};
        if (up.name) su.name = up.name;
        if (up.contact) su.contact = up.contact;
        if (up.address) su.address = up.address;
        if (Object.keys(su).length > 0) {
          s.set(su);
          await s.save();
          updatedStudent = s.toObject();
        }
      }
    } catch (e) {/* ignore */}
    try {
      let f = await Faculty.findOne({
        email: updatedUser && updatedUser.username
      }).catch(() => null);
      if (!f && updatedUser && updatedUser.name) f = await Faculty.findOne({
        name: updatedUser.name
      }).catch(() => null);
      if (f) {
        const fu = {};
        if (up.name) fu.name = up.name;
        if (up.contact) fu.contact = up.contact;
        if (up.address) fu.address = up.address;
        if (Object.keys(fu).length > 0) {
          f.set(fu);
          await f.save();
          updatedFaculty = f.toObject();
        }
      }
    } catch (e) {/* ignore */}
    return res.json({
      user: updatedUser,
      student: updatedStudent,
      faculty: updatedFaculty
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Password reset: request reset (creates token, emails user)

  return router;
};
