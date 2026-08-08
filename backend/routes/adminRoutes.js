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
    similarity, PDFDocument, fs, path, bcrypt, jwt, sendMail
  } = helpers;

// Admin: list contact queries
router.get("/contact-queries", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await prisma.contactQuery.findMany({
      orderBy: {
        createdAt: "desc"
      }
    }).catch(() => []);
    // Attach URL for downloads
    const out = (list || []).map(it => ({
      ...it,
      url: it.filename ? `/uploads/${it.filename}` : undefined
    }));
    return res.json(out);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: update status and optionally add a note and mark notified
router.patch("/contact-queries/:id/status", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const id = req.params.id;
    const {
      status,
      notify,
      note
    } = req.body || {};
    if (!id) return res.status(400).json({
      message: 'id required'
    });
    const doc = await prisma.contactQuery.findUnique({
      where: {
        id: String(id)
      }
    });
    if (!doc) return res.status(404).json({
      message: 'not found'
    });
    if (status) doc.status = status;
    if (note) {
      doc.notes = doc.notes || [];
      doc.notes.push({
        text: String(note || ''),
        author: req.user && req.user.sub ? req.user.sub : null
      });
      // also set a top-level note for compatibility with older frontend usages
      doc.note = String(note || '');
    }
    if (notify) doc.notified = true;
    // Transpiled save()
    if (doc) {
      const { id: _unused_id, _id: _unused__id, save: _unused_save, toObject: _unused_toObject, ..._updateData } = doc;
      
      // Clean out relational arrays if any to prevent Prisma crash
      for (const k in _updateData) {
        if (Array.isArray(_updateData[k]) && _updateData[k].length > 0 && typeof _updateData[k][0] === 'object') {
           delete _updateData[k];
        }
      }

      await prisma.contactQuery.update({
        where: { id: String(((doc.id || doc._id))) },
        data: _updateData
      }).catch(e => console.error("Transpiled save error:", e.message));
    }

    // Return updated document (lean-like)
    const out = (await prisma.contactQuery.findUnique({
      where: {
        id: String(id)
      }
    })) || {};
    out.url = out.filename ? `/uploads/${out.filename}` : undefined;
    return res.json(out);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: update faculty fields (accept assignments, houses, role)

// admin-only route example
router.get("/dashboard", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    // Total number of students
    const studentsCount = await prisma.student.count().catch(() => 0);

    // Total number of teachers/faculty
    const teachersCount = await prisma.faculty.count().catch(() => 0);

    // Number of distinct classes (from students)
    let classesCount = 0;
    try {
      
      const cQuery = await prisma.student.findMany({ select: { class: true }, distinct: ['class'] });
      const classes = cQuery.map(c => c.class);

      classesCount = Array.isArray(classes) ? classes.filter(Boolean).length : 0;
    } catch (e) {
      classesCount = 0;
    }

    // Total fee collection (sum of receipts.amount)
    let feesTotal = 0;
    try {
      
      const agg = await prisma.receipt.aggregate({ _sum: { amount: true } });

      
      feesTotal = agg && agg._sum && agg._sum.amount ? agg._sum.amount : 0;

    } catch (e) {
      feesTotal = 0;
    }
    return res.json({
      students: studentsCount,
      teachers: teachersCount,
      classes: classesCount,
      fees: feesTotal
    });
  } catch (e) {
    // In case of unexpected error, return a friendly message
    return res.status(500).json({
      message: 'Failed to prepare dashboard metrics',
      error: e && e.message
    });
  }
});

// Complaints

// Admin: custom form builder
router.get("/custom-forms", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const items = await prisma.customForm.findMany({
      orderBy: {
        createdAt: "desc"
      }
    }).catch(() => []);
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.post("/custom-forms", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      title,
      category = 'General',
      description = '',
      status = 'active',
      fields = []
    } = req.body || {};
    if (!title) return res.status(400).json({
      message: 'title required'
    });
    if (!Array.isArray(fields) || fields.length === 0) return res.status(400).json({
      message: 'at least one field required'
    });
    const cleanFields = fields.filter(field => field && String(field.label || '').trim()).map(field => ({
      label: String(field.label || '').trim(),
      type: String(field.type || 'text'),
      required: !!field.required,
      placeholder: String(field.placeholder || ''),
      options: Array.isArray(field.options) ? field.options.map(opt => String(opt).trim()).filter(Boolean) : []
    }));
    const doc = await CustomForm.create({
      data: {
        title: String(title),
        category: String(category || 'General'),
        description: String(description || ''),
        status: String(status || 'active'),
        fields: cleanFields,
        createdBy: req.user && req.user.sub
      }
    });
    return res.status(201).json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.put("/custom-forms/:id", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      title,
      category = 'General',
      description = '',
      status = 'active',
      fields = []
    } = req.body || {};
    if (!title) return res.status(400).json({
      message: 'title required'
    });
    if (!Array.isArray(fields) || fields.length === 0) return res.status(400).json({
      message: 'at least one field required'
    });
    const cleanFields = fields.filter(field => field && String(field.label || '').trim()).map(field => ({
      _id: ((field.id || field._id)),
      label: String(field.label || '').trim(),
      type: String(field.type || 'text'),
      required: !!field.required,
      placeholder: String(field.placeholder || ''),
      options: Array.isArray(field.options) ? field.options.map(opt => String(opt).trim()).filter(Boolean) : []
    }));
    const doc = await prisma.customForm.update({
      where: {
        id: String(req.params.id)
      },

      data: {
        title: String(title),
        category: String(category || 'General'),
        description: String(description || ''),
        status: String(status || 'active'),
        fields: cleanFields
      }
    });
    if (!doc) return res.status(404).json({
      message: 'Form not found'
    });
    return res.json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.delete("/custom-forms/:id", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const doc = await prisma.customForm.delete({
      where: {
        id: String(req.params.id)
      }
    });
    if (!doc) return res.status(404).json({
      message: 'Form not found'
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

// Public: submit a form query for a given uploaded form (optional attachment)

// Admin: list submitted contact queries
router.get("/contact-queries", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const items = await prisma.contactQuery.findMany({
      orderBy: {
        createdAt: "desc"
      }
    }).catch(() => []);
    const mapped = (items || []).map(it => ({
      ...it,
      url: it.filename ? `/uploads/${it.filename}` : undefined
    }));
    return res.json(mapped);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: update status of a contact query and optionally notify
router.patch("/contact-queries/:id/status", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const id = req.params && req.params.id;
    const {
      status,
      notify = false,
      note = ''
    } = req.body || {};
    if (!id) return res.status(400).json({
      message: 'id required'
    });
    const doc = await prisma.contactQuery.findUnique({
      where: {
        id: String(id)
      }
    }).catch(() => null);
    if (!doc) return res.status(404).json({
      message: 'Not found'
    });
    if (status) doc.status = String(status);
    // Transpiled save()
    if (doc) {
      const { id: _unused_id, _id: _unused__id, save: _unused_save, toObject: _unused_toObject, ..._updateData } = doc;
      
      // Clean out relational arrays if any to prevent Prisma crash
      for (const k in _updateData) {
        if (Array.isArray(_updateData[k]) && _updateData[k].length > 0 && typeof _updateData[k][0] === 'object') {
           delete _updateData[k];
        }
      }

      await prisma.contactQuery.update({
        where: { id: String(((doc.id || doc._id))) },
        data: _updateData
      }).catch(e => console.error("Transpiled save error:", e.message));
    }

    // Send email to user if requested
    if (notify && doc.email) {
      try {
        const body = `<p>Your contact query status has been updated to <strong>${doc.status}</strong>.</p><p>${note ? `<strong>Note:</strong><br/>${String(note).replace(/\n/g, '<br/>')}` : ''}</p>`;
        await sendMail({
          to: doc.email,
          subject: `Your contact query status: ${doc.status}`,
          html: body
        }).catch(() => null);
        doc.notified = true;
        await prisma.contactQuery.update({ where: { id: doc.id }, data: { notified: doc.notified, status: doc.status } }).catch(() => null);
      } catch (e) {/* ignore mail errors */}
    }
    return res.json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: list submitted form queries
router.get("/form-queries", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const items = await prisma.formQuery.findMany({
      orderBy: {
        createdAt: "desc"
      }
    }).catch(() => []);
    const mapped = (items || []).map(it => ({
      ...it,
      url: it.filename ? `/uploads/${it.filename}` : undefined
    }));
    return res.json(mapped);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: compute student rank analytics by class/section
router.get("/analytics/student-rank", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    // filters: class, section, source (testResults|reportCards|both), from, to, limit
    const cls = req.query.class ? String(req.query.class) : null;
    const section = req.query.section ? String(req.query.section) : null;
    const source = req.query.source || 'both';
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    const limit = Math.min(Number(req.query.limit) || 2000, 2000);

    // We'll build a map of student identifier -> aggregated data
    const map = new Map();

    // Helper to push test result into map
    function pushTestResult(key, r) {
      const entry = map.get(key) || {
        name: r.name || '',
        studentId: r.studentId || null,
        class: r.class || '',
        section: r.section || '',
        scores: [],
        hasReportCard: false,
        reportPercentage: undefined,
        email: r.email || '',
        rollNumber: r.rollNo || ''
      };
      entry.name = entry.name || r.name || '';
      entry.class = entry.class || r.class || '';
      entry.section = entry.section || r.section || '';
      entry.email = entry.email || r.email || '';
      entry.rollNumber = entry.rollNumber || r.rollNo || '';
      if (typeof r.percentage === 'number' && !isNaN(r.percentage)) entry.scores.push(Number(r.percentage));else if (typeof r.score === 'number' && typeof r.total === 'number' && r.total > 0) entry.scores.push(Number(r.score) / Number(r.total) * 100);
      map.set(key, entry);
    }

    // Helper to push report card into map (prefer report card percentage)
    function pushReportCard(key, c) {
      const entry = map.get(key) || {
        name: c.recipientName || '',
        studentId: c.recipientId || null,
        class: c.className || '',
        section: c.section || '',
        scores: [],
        hasReportCard: false,
        reportPercentage: undefined,
        email: c.recipientEmail || '',
        rollNumber: c.rollNumber || ''
      };
      entry.name = entry.name || c.recipientName || '';
      entry.class = entry.class || c.className || '';
      entry.section = entry.section || c.section || '';
      entry.email = entry.email || c.recipientEmail || '';
      entry.rollNumber = entry.rollNumber || c.rollNumber || '';
      if (typeof c.percentage === 'number' && !isNaN(c.percentage)) {
        entry.reportPercentage = Number(c.percentage);
        entry.hasReportCard = true;
      }
      map.set(key, entry);
    }

    // Fetch test results if requested
    if (source === 'testResults' || source === 'both') {
      const q = {};
      if (cls) q.class = cls;
      if (section) q.section = section;
      if (from || to) q.submittedAt = {};
      if (from) q.submittedAt.gte = from;
      if (to) q.submittedAt.lte = to;
      const results = await prisma.testResult.findMany({
        where: q
      }).catch(() => []);
      for (const r of results || []) {
        const key = r.studentId ? String(r.studentId) : `${r.email || r.name || ''}::${r.class || ''}::${r.section || ''}`;
        pushTestResult(key, r);
      }
    }

    // Fetch report cards if requested
    if (source === 'reportCards' || source === 'both') {
      const q = {};
      if (cls) q.className = cls;
      if (section) q.section = section;
      if (from || to) q.createdAt = {};
      if (from) q.createdAt.gte = from;
      if (to) q.createdAt.lte = to;
      const cards = await prisma.reportCard.findMany({
        where: q
      }).catch(() => []);
      for (const c of cards || []) {
        const key = c.recipientId ? String(c.recipientId) : `${c.recipientEmail || c.recipientName || ''}::${c.className || ''}::${c.section || ''}`;
        pushReportCard(key, c);
      }
    }

    // Convert map to array and compute aggregate score (prefer report card percentage when present)
    const rows = [];
    for (const [key, v] of map.entries()) {
      // If a report card percentage is present, use it as the basis
      if (v.hasReportCard && typeof v.reportPercentage === 'number' && !isNaN(v.reportPercentage)) {
        rows.push({
          key,
          name: v.name || '',
          studentId: v.studentId || null,
          class: v.class || '',
          section: v.section || '',
          avg: Number(v.reportPercentage.toFixed(2)),
          count: 1,
          email: v.email || '',
          rollNumber: v.rollNumber || ''
        });
        continue;
      }
      const scores = (v.scores || []).filter(s => typeof s === 'number' && !isNaN(s));
      if (scores.length === 0) continue;
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      rows.push({
        key,
        name: v.name || '',
        studentId: v.studentId || null,
        class: v.class || '',
        section: v.section || '',
        avg: Number(avg.toFixed(2)),
        count: scores.length,
        email: v.email || '',
        rollNumber: v.rollNumber || ''
      });
    }

    // Ensure every student matching the filters is present in the rows.
    // Students without test/report data will have `count: 0` and `avg: null` and will sort after students with tests.
    try {
      const sq = {};
      if (cls) sq.class = cls;
      if (section) sq.section = section;
      const students = await prisma.student.findMany({
        where: sq
      }).catch(() => []);
      for (const s of students || []) {
        const skey = ((s.id || s._id)) ? String(((s.id || s._id))) : `${s.email || s.name || ''}::${s.class || ''}::${s.section || ''}`;
        const exists = rows.some(r => r.key === skey);
        if (!exists) {
          rows.push({
            key: skey,
            name: s.name || '',
            studentId: ((s.id || s._id)) || null,
            class: s.class || '',
            section: s.section || '',
            avg: null,
            count: 0,
            email: s.email || '',
            rollNumber: s.rollNo || ''
          });
        }
      }
    } catch (e) {
      // ignore student lookup failure and continue with existing rows
    }

    // Sort by class, then section, then count desc (more tests first), then avg desc, then name asc
    rows.sort((a, b) => {
      if ((a.class || '') < (b.class || '')) return -1;
      if ((a.class || '') > (b.class || '')) return 1;
      if ((a.section || '') < (b.section || '')) return -1;
      if ((a.section || '') > (b.section || '')) return 1;
      // prefer higher count (more tests) first
      const ca = Number(a.count || 0),
        cb = Number(b.count || 0);
      if (ca !== cb) return cb - ca;
      // then higher average
      const aa = typeof a.avg === 'number' ? a.avg : -Infinity;
      const ab = typeof b.avg === 'number' ? b.avg : -Infinity;
      if (aa !== ab) return ab - aa;
      // finally by name
      if ((a.name || '') < (b.name || '')) return -1;
      if ((a.name || '') > (b.name || '')) return 1;
      return 0;
    });

    // Add rank within each class-section
    const ranked = [];
    let currentClass = null,
      currentSection = null,
      rank = 0;
    for (const r of rows) {
      if (r.class !== currentClass || r.section !== currentSection) {
        currentClass = r.class;
        currentSection = r.section;
        rank = 1;
      } else rank++;
      ranked.push({
        ...r,
        rank
      });
      if (ranked.length >= limit) break;
    }
    return res.json(ranked);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Gallery endpoints: Admin can create gallery entries (label + multiple images). Public can list.

  return router;
};
