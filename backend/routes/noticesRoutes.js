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

// Admin: create a notice (target one or more roles)
// Admin: create a notice (target one or more roles) - supports optional PDF upload and student filters
router.post("/", verifyToken, requireRole('admin'), upload.single('file'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      title,
      body,
      targets
    } = req.body || {};
    if (!title) return res.status(400).json({
      message: 'title required'
    });
    const t = Array.isArray(targets) ? targets : typeof targets === 'string' ? targets.split(',').map(s => s.trim()) : ['all'];
    const file = req.file;
    const filePath = file ? `/uploads/${file.filename}` : '';
    const fileName = file ? file.originalname : '';
    const fileMime = file ? file.mimetype : '';

    // student targeting
    const studentAll = req.body.studentAll === undefined ? true : String(req.body.studentAll) === 'true' || req.body.studentAll === '1';
    const studentClass = req.body.studentClass || '';
    const studentSection = req.body.studentSection || '';
    const doc = await Notice.create({
      title,
      body: body || '',
      targets: t.length ? t : ['all'],
      createdBy: req.user && req.user.sub,
      createdByName: req.user && (req.user.name || req.user.username),
      filePath,
      fileName,
      fileMime,
      studentAll,
      studentClass: studentClass || undefined,
      studentSection: studentSection || undefined
    });
    try {
      sendSseEvent('notice_created', {
        id: doc._id,
        targets: doc.targets
      });
    } catch (e) {}

    // Async notification logic
    (async () => {
      try {
        let phoneTargets = [];
        if (doc.targets.includes('all') || doc.targets.includes('student')) {
          let q = {};
          if (!doc.studentAll) {
            if (doc.studentClass) q.class = doc.studentClass;
            if (doc.studentSection) q.section = doc.studentSection;
          }
          const studs = await prisma.student.findMany({
            where: q
          });
          studs.forEach(s => s.contact && phoneTargets.push({
            phone: s.contact,
            email: s.email
          }));
        }
        if (doc.targets.includes('all') || doc.targets.includes('faculty')) {
          const facs = await prisma.faculty.findMany();
          facs.forEach(f => f.contact && phoneTargets.push({
            phone: f.contact,
            email: f.email
          }));
        }
        for (const t of phoneTargets) {
          await notifyEvent({
            event: 'new_notice',
            phone: t.phone,
            message: `New Notice: ${doc.title}. Please check the ERP portal.`,
            emailOpts: {
              to: t.email,
              subject: `Notice: ${doc.title}`,
              text: `New Notice: ${doc.title}\n\n${doc.body}`
            }
          }).catch(() => {});
        }
      } catch (e) {
        console.warn('Failed to notify for new notice', e.message);
      }
    })();
    return res.status(201).json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Get notices: admin can optionally filter by role via ?role=student|faculty|parent
router.get("/", verifyToken, async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    // Admin can list all or filter by role
    if (req.user && req.user.role === 'admin') {
      const q = {};
      if (req.query && req.query.role) q.targets = req.query.role;
      const items = await prisma.notice.findMany({
        where: q,

        orderBy: {
          createdAt: "desc"
        }
      });
      return res.json(items);
    }
    // Non-admins: return notices targeted to their role or 'all'
    const role = req.user && req.user.role;
    const items = await prisma.notice.findMany({
      where: {
        OR: [{
          targets: 'all'
        }, {
          targets: role
        }]
      },

      orderBy: {
        createdAt: "desc"
      }
    });
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: delete a notice
router.delete("/:id", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const id = req.params.id;
    await prisma.notice.delete({
      where: { id: String(id) }
    });
    return res.json({ message: 'Notice deleted' });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

  return router;
};
