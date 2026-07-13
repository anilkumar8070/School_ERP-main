
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
    similarity, PDFDocument, fs, path, bcrypt, jwt
  } = helpers;

// Faculty: upload a resource (PDF) for students
// Allow faculty and admin to upload resources (admin can upload forms)
router.post("/", verifyToken, requireRole(['faculty', 'admin']), upload.single('file'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      title,
      subject
    } = req.body || {};
    const klass = req.body.class || req.body.klass || req.body.cls || '';
    if (!title) return res.status(400).json({
      message: 'title required'
    });
    const file = req.file;
    if (!file) return res.status(400).json({
      message: 'file required'
    });
    const filePath = `/uploads/${file.filename}`;
    const doc = await Resource.create({
      title: title || file.originalname,
      subject: subject || '',
      class: String(klass || ''),
      filename: file.filename,
      originalname: file.originalname,
      uploadedBy: req.user && req.user.sub
    });
    return res.status(201).json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Authenticated: list resources (students and faculty)
router.get("/", verifyToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const q = {};
    if (req.query.class || req.query.cls) q.class = String(req.query.class || req.query.cls);
    if (req.query.subject) q.subject = req.query.subject;
    const items = await Resource.find(q).sort({
      createdAt: -1
    }).lean();
    // attach accessible file URL
    const host = '';
    const mapped = items.map(it => ({
      ...it,
      url: `/uploads/${it.filename}`
    }));
    return res.json(mapped);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Faculty/Admin: delete a resource. Faculty can delete only their own uploads.
router.delete("/:id", verifyToken, requireRole(['faculty', 'admin']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const id = req.params && req.params.id;
    if (!id) return res.status(400).json({
      message: 'id required'
    });
    const item = await Resource.findById(id).catch(() => null);
    if (!item) return res.status(404).json({
      message: 'Resource not found'
    });
    const isAdmin = req.user && req.user.role === 'admin';
    const isOwner = item.uploadedBy && req.user && String(item.uploadedBy) === String(req.user.sub);
    if (!isAdmin && !isOwner) return res.status(403).json({
      message: 'You can delete only your own resources'
    });
    try {
      if (item.filename) {
        const filePath = path.join(uploadsDir, String(item.filename));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    } catch (fileErr) {
      console.warn('Failed to delete resource file', fileErr && fileErr.message);
    }
    await item.deleteOne();
    return res.json({
      ok: true
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Public: list uploaded forms/resources for download (used on Start page)

// Faculty: list resources uploaded by the current faculty member

// (timetable endpoints implemented later — keep single richer implementation)

// Admin helper: regenerate PDFs for timetables that have `content` but no `filePath`.
// Useful after installing pdfkit if earlier saves didn't create PDFs.

// Regenerate PDF for a single timetable id

// Faculty: list submissions for an assignment

// Faculty: extend due date (edit assignment)

// Admin: delete a student (remove student record and associated user, notify student)

// Admin: update a student's class/section/roll/name and optional demographics

// Faculty: change a student's class (assign new section & roll no automatically)

// Faculty: set a student's stream (only permitted for faculty role)

// Faculty: block/unblock student (faculty-initiated)

// Faculty: create a delete request for a student (goes to admin approvals)

// Admin: list delete requests

// Admin: approve a delete request (deletes student and user)

// Admin: block/unblock a student's login account (by student id)

// Faculty management: list, update, delete (admin only)

// Admin: block or unblock a faculty's user account (by faculty id)

// Syllabus

// Timetable endpoints - allow admin to upload a timetable (file or JSON content)

// Query timetables for a class/section. Returns history (newest-first).
router.get("/my", verifyToken, requireRole('faculty'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const uploader = req.user && req.user.sub;
    if (!uploader) return res.status(400).json({
      message: 'uploader id missing'
    });
    const items = await Resource.find({
      uploadedBy: uploader
    }).sort({
      createdAt: -1
    }).lean();
    const mapped = items.map(it => ({
      ...it,
      url: `/uploads/${it.filename}`
    }));
    return res.json(mapped);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

  return router;
};
