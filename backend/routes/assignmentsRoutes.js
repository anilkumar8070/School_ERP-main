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

// List assignments (any authenticated user can read)
router.get("/", verifyToken, async (req, res) => {
  try {
    const q = {};
    const {
      class: cls,
      section
    } = req.query || {};
    if (cls) q.class = String(cls);
    if (section) q.section = String(section);
    const items = await prisma.assignment.findMany({ where: q }).sort({
      createdAt: -1
    }).catch(() => []);
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Create assignment (faculty or admin)
router.post("/", verifyToken, requireRole(['admin', 'faculty']), upload.single('file'), async (req, res) => {
  try {
    if (false) return res.status(503).json({
      message: 'Database not available'
    });
    const body = req.body || {};
    if (!body.title || !body.class) return res.status(400).json({
      message: 'title and class required'
    });
    const file = req.file;
    const filePath = file ? `/uploads/${file.filename}` : '';
    const doc = await Assignment.create({
      title: String(body.title || ''),
      description: String(body.description || ''),
      subject: String(body.subject || ''),
      class: String(body.class || ''),
      section: body.section || 'ALL',
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      filePath,
      createdBy: req.user && req.user.sub
    });
    return res.status(201).json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Student: submit an assignment (optional file). Reject if past due date.
router.post("/:id/submit", verifyToken, requireRole('student'), upload.single('file'), async (req, res) => {
  try {
    if (false) return res.status(503).json({
      message: 'Database not available'
    });
    const aid = req.params.id;
    const assignment = await prisma.assignment.findUnique({ where: { id: String(aid) } }).catch(() => null);
    if (!assignment) return res.status(404).json({
      message: 'Assignment not found'
    });
    // Check due date: if present and now > dueDate, reject submission
    if (assignment.dueDate) {
      const now = new Date();
      const due = new Date(assignment.dueDate);
      if (now > due) return res.status(403).json({
        message: 'Submission window closed: assignment due date passed'
      });
    }
    const username = req.user && req.user.username;
    const studentRec = await Student.findOne({
      email: username
    }).catch(() => null);
    const file = req.file;
    const filePath = file ? `/uploads/${file.filename}` : req.body && req.body.filePath ? String(req.body.filePath) : '';
    const sub = await Submission.create({
      assignmentId: aid,
      studentId: studentRec ? studentRec._id : undefined,
      studentName: studentRec ? studentRec.name : req.body && req.body.studentName || '',
      studentRoll: studentRec ? studentRec.rollNo : req.body && req.body.studentRoll || '',
      studentClass: studentRec ? studentRec.class : req.body && req.body.studentClass || '',
      studentEmail: username || req.body && req.body.studentEmail || '',
      answerText: req.body && req.body.answerText ? String(req.body.answerText) : '',
      filePath,
      submittedAt: new Date()
    });
    return res.status(201).json(sub);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// List submissions for an assignment. Students see only their own; parents need studentId; faculty/admin see all.
router.get("/:id/submissions", verifyToken, async (req, res) => {
  try {
    if (false) return res.status(503).json({
      message: 'Database not available'
    });
    const aid = req.params.id;
    const role = req.user && req.user.role;
    const username = req.user && req.user.username;
    const q = {
      assignmentId: aid
    };
    if (role === 'student') {
      q.studentEmail = username;
    } else if (role === 'parent') {
      const {
        studentId
      } = req.query || {};
      if (!studentId) return res.status(400).json({
        message: 'studentId required for parent'
      });
      const user = await prisma.user.findUnique({ where: { id: String(req.user.sub) } }).catch(() => null);
      if (!user || user.role !== 'parent') return res.status(403).json({
        message: 'Unauthorized'
      });
      const allowed = Array.isArray(user.parentOf) && user.parentOf.some(x => String(x) === String(studentId));
      if (!allowed) return res.status(403).json({
        message: 'Not linked to this student'
      });
      q.studentId = studentId;
    }
    const subs = await prisma.submission.findMany({ where: q }).sort({
      createdAt: -1
    }).catch(() => []);
    return res.json(subs);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
// Create an assignment (faculty)
router.post("/", verifyToken, requireRole('faculty'), upload.single('file'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      subject,
      title,
      description,
      class: cls,
      section = 'ALL',
      dueDate
    } = req.body || {};
    if (!title || !cls) return res.status(400).json({
      message: 'title and class required'
    });
    // Ensure faculty is assigned to this class/section
    if (req.user && req.user.role === 'faculty') {
      const u = await prisma.user.findUnique({ where: { id: String(req.user.sub) } }).catch(() => null);
      if (!u) return res.status(403).json({
        message: 'Unauthorized'
      });
      let fac = await Faculty.findOne({
        email: u.username
      }).catch(() => null);
      if (!fac && u.name) fac = await Faculty.findOne({
        name: u.name
      }).catch(() => null);
      if (!fac && u.contact) fac = await Faculty.findOne({
        contact: u.contact
      }).catch(() => null);
      if (!fac) return res.status(403).json({
        message: 'Faculty record not linked'
      });
      let allowed = false;
      for (const a of fac.assignments || []) {
        if (String(a.class) !== String(cls)) continue;
        if (a.isClassTeacher) {
          allowed = true;
          break;
        }
        if (a.section && String(a.section) === String(section)) {
          allowed = true;
          break;
        }
      }
      if (!allowed) return res.status(403).json({
        message: 'Not assigned to this class/section'
      });
    }
    const doc = await Assignment.create({
      subject,
      title,
      description,
      class: String(cls),
      section: section || 'ALL',
      dueDate: dueDate ? new Date(dueDate) : null,
      createdBy: req.user && req.user.sub
    });
    // attach uploaded file path as metadata (not stored on schema currently)
    if (req.file) {
      doc.filePath = `/uploads/${req.file.filename}`;
    }
    await doc.save();
    // emit SSE for students (optional)
    try {
      sendSseEvent('assignment_created', {
        id: doc._id,
        class: doc.class,
        section: doc.section
      });
    } catch (e) {}
    return res.status(201).json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// List assignments (students and faculty). Query by class and section.
router.get("/", verifyToken, async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const cls = req.query.class || req.query.cls || null;
    const section = req.query.section || req.query.sec || null;
    const q = {};
    if (cls) q.class = String(cls);
    // match either the specific section or 'ALL'
    if (section) q.$or = [{
      section
    }, {
      section: 'ALL'
    }];
    const items = await prisma.assignment.findMany({ where: q }).sort({
      createdAt: -1
    });
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Test Management
// Create a test series (admin or faculty). Supports optional file upload (e.g., CSV or resources)

// Student: submit an assignment answer (file optional)
router.post("/:id/submit", verifyToken, upload.single('file'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const assignment = await prisma.assignment.findUnique({ where: { id: String(req.params.id) } });
    if (!assignment) return res.status(404).json({
      message: 'Assignment not found'
    });
    // check due date
    if (assignment.dueDate && new Date() > new Date(assignment.dueDate)) return res.status(400).json({
      message: 'Submission closed — due date passed'
    });
    const answerText = req.body.answerText || '';
    const student = await Student.findOne({
      email: req.user.username
    }).catch(() => null);
    const submission = await Submission.create({
      assignmentId: assignment._id,
      studentId: student ? student._id : null,
      studentName: student ? student.name : req.user.name || '',
      studentEmail: req.user.username || '',
      studentRoll: student ? student.rollNo || '' : '',
      studentClass: student ? student.class || '' : '',
      answerText,
      filePath: req.file ? `/uploads/${req.file.filename}` : ''
    });
    // notify faculty via SSE
    try {
      sendSseEvent('assignment_submitted', {
        assignmentId: assignment._id,
        submissionId: submission._id,
        studentEmail: submission.studentEmail
      });
    } catch (e) {}
    return res.status(201).json(submission);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Leaves: student apply for leave

// Faculty: list submissions for an assignment
router.get("/:id/submissions", verifyToken, requireRole('faculty'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const subs = await Submission.find({
      assignmentId: req.params.id
    }).sort({
      createdAt: -1
    });
    return res.json(subs);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Faculty: extend due date (edit assignment)
router.put("/:id/extend", verifyToken, requireRole('faculty'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      dueDate
    } = req.body || {};
    if (!dueDate) return res.status(400).json({
      message: 'dueDate required'
    });
    const a = await prisma.assignment.findUnique({ where: { id: String(req.params.id) } });
    if (!a) return res.status(404).json({
      message: 'Assignment not found'
    });
    a.dueDate = new Date(dueDate);
    await a.save();
    return res.json(a);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: delete a student (remove student record and associated user, notify student)

// List assignments (students, faculty, admin can access)
router.get("/", verifyToken, async (req, res) => {
  try {
    const q = {};
    const {
      class: cls,
      section
    } = req.query || {};
    if (cls) q.class = String(cls);
    if (section) q.section = String(section);
    const items = await prisma.assignment.findMany({ where: q }).sort({
      createdAt: -1
    }).catch(() => []);
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Create assignment (faculty or admin)
router.post("/", verifyToken, requireRole(['admin', 'faculty']), upload.single('file'), async (req, res) => {
  try {
    if (false) return res.status(503).json({
      message: 'Database not available'
    });
    const body = req.body || {};
    if (!body.title || !body.class) return res.status(400).json({
      message: 'title and class required'
    });
    const file = req.file;
    const filePath = file ? `/uploads/${file.filename}` : '';
    const doc = await Assignment.create({
      title: String(body.title || ''),
      description: String(body.description || ''),
      subject: String(body.subject || ''),
      class: String(body.class || ''),
      section: body.section || 'ALL',
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      filePath,
      createdBy: req.user && req.user.sub
    });
    return res.status(201).json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Student: submit an assignment (optional file)
router.post("/:id/submit", verifyToken, requireRole('student'), upload.single('file'), async (req, res) => {
  try {
    if (false) return res.status(503).json({
      message: 'Database not available'
    });
    const aid = req.params.id;
    const assignment = await prisma.assignment.findUnique({ where: { id: String(aid) } }).catch(() => null);
    if (!assignment) return res.status(404).json({
      message: 'Assignment not found'
    });
    // resolve student record from authenticated user
    const username = req.user && req.user.username;
    const studentRec = await Student.findOne({
      email: username
    }).catch(() => null);
    const file = req.file;
    const filePath = file ? `/uploads/${file.filename}` : req.body && req.body.filePath ? String(req.body.filePath) : '';
    const sub = await Submission.create({
      assignmentId: aid,
      studentId: studentRec ? studentRec._id : undefined,
      studentName: studentRec ? studentRec.name : req.body && req.body.studentName || '',
      studentRoll: studentRec ? studentRec.rollNo : req.body && req.body.studentRoll || '',
      studentClass: studentRec ? studentRec.class : req.body && req.body.studentClass || '',
      studentEmail: username || req.body && req.body.studentEmail || '',
      answerText: req.body && req.body.answerText ? String(req.body.answerText) : '',
      filePath,
      submittedAt: new Date()
    });
    return res.status(201).json(sub);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// List submissions for an assignment. Faculty/admin see all, student sees only their own, parent must specify studentId
router.get("/:id/submissions", verifyToken, async (req, res) => {
  try {
    if (false) return res.status(503).json({
      message: 'Database not available'
    });
    const aid = req.params.id;
    const role = req.user && req.user.role;
    const username = req.user && req.user.username;
    const q = {
      assignmentId: aid
    };
    if (role === 'student') {
      // student may only see their own submissions
      q.studentEmail = username;
    } else if (role === 'parent') {
      const {
        studentId
      } = req.query || {};
      if (!studentId) return res.status(400).json({
        message: 'studentId required for parent'
      });
      // ensure parent linked to this student
      const user = await prisma.user.findUnique({ where: { id: String(req.user.sub) } }).catch(() => null);
      if (!user || user.role !== 'parent') return res.status(403).json({
        message: 'Unauthorized'
      });
      const allowed = Array.isArray(user.parentOf) && user.parentOf.some(x => String(x) === String(studentId));
      if (!allowed) return res.status(403).json({
        message: 'Not linked to this student'
      });
      q.studentId = studentId;
    } else {
      // admin/faculty: no extra filter
    }
    const subs = await prisma.submission.findMany({ where: q }).sort({
      createdAt: -1
    }).catch(() => []);
    return res.json(subs);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

  return router;
};
