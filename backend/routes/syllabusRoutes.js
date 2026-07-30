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

// Admin: upload syllabus for a class/section
router.post("/", verifyToken, requireRole('admin'), upload.single('file'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      class: cls,
      section = 'ALL',
      subject
    } = req.body || {};
    if (!cls) return res.status(400).json({
      message: 'class required'
    });
    const file = req.file;
    const filePath = file ? `/uploads/${file.filename}` : '';
    const doc = await Syllabus.create({
      class: String(cls),
      section: section || 'ALL',
      subject: subject || '',
      name: file ? file.originalname : '',
      mime: file ? file.mimetype : '',
      filePath,
      uploadedBy: req.user && req.user.sub
    });
    return res.status(201).json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: create a notice (target one or more roles)
// Admin: create a notice (target one or more roles) - supports optional PDF upload and student filters

// Public: get syllabus for a class and section (match specific section or ALL)
router.get("/", async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const cls = req.query.class || req.query.cls || null;
    const section = req.query.section || req.query.sec || null;
    // If no class provided, return all syllabus entries (legacy callers expect this)
    if (!cls) {
      const items = await prisma.syllabus.findMany({
        orderBy: {
          uploadedAt: "desc"
        }
      });
      return res.json(items);
    }
    // prefer exact section, but include ALL as fallback; return most recent
    const q = {
      class: String(cls)
    };
    if (section) q.$or = [{
      section
    }, {
      section: 'ALL'
    }];
    const items = await prisma.syllabus.findMany({
      where: q,

      orderBy: {
        uploadedAt: "desc"
      }
    });
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: delete a syllabus entry (and its uploaded file)
router.delete("/:id", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({
      message: 'id required'
    });
    const doc = await prisma.syllabus.findUnique({
      where: {
        id: String(id)
      }
    });
    if (!doc) return res.status(404).json({
      message: 'Syllabus not found'
    });
    // try to remove uploaded file if exists
    try {
      if (doc.filePath) {
        const fp = path.join(__dirname, doc.filePath.replace(/^\//, ''));
        if (fs.existsSync(fp)) {
          fs.unlinkSync(fp);
        }
      }
    } catch (e) {
      console.warn('Failed to unlink syllabus file', doc.filePath, e && e.message);
    }
    await Syllabus.deleteOne({
      _id: id
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

// Faculty: upload a resource (PDF) for students
// Allow faculty and admin to upload resources (admin can upload forms)

// Syllabus
router.post("/", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  const {
    subject,
    content
  } = req.body || {};
  if (!subject) return res.status(400).json({
    message: 'subject required'
  });
  try {
    const s = await Syllabus.findOneAndUpdate({
      subject
    }, {
      content,
      uploadedBy: req.user.sub
    }, {
      upsert: true,
      new: true
    });
    return res.status(201).json(s);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.get("/", async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const items = await prisma.syllabus.findMany();
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Timetable endpoints - allow admin to upload a timetable (file or JSON content)

  return router;
};
