
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

// ===================== ID Card APIs =====================
// Generate ID cards for a class & section in one batch
router.post("/generate", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const klass = req.body && req.body.class;
    const section = req.body && req.body.section;
    const schoolName = req.body && req.body.schoolName || 'SCHOOL NAME';
    const reqIssueDate = req.body && req.body.issueDate ? new Date(req.body.issueDate) : new Date();
    const reqValidUpto = req.body && req.body.validUpto ? new Date(req.body.validUpto) : new Date(reqIssueDate.getTime() + 365 * 24 * 60 * 60 * 1000);
    if (!klass || !section) return res.status(400).json({
      message: 'class and section required'
    });
    const students = await Student.find({
      class: String(klass),
      section: String(section)
    }).lean().catch(() => []);
    const batchId = `batch_${Date.now()}`;
    const out = [];
    for (const st of students) {
      let latest = null;
      try {
        latest = await IDCard.findOne({
          studentId: st._id
        }).sort({
          version: -1,
          createdAt: -1
        }).lean().catch(() => null);
      } catch {}
      const version = latest ? Number(latest.version || 1) + 1 : 1;
      let idCode = latest && latest.idCode ? latest.idCode : makeId('IDC_');
      let created = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          created = await IDCard.create({
            studentId: st._id,
            type: 'student',
            name: st.name || '',
            fatherName: st.fatherName || '',
            rollNo: st.rollNo || '',
            class: st.class || String(klass),
            medium: st.medium || '',
            section: st.section || String(section),
            contact: st.contact || '',
            house: st.house || '',
            houseRole: st.houseRole || '',
            schoolName,
            photoUrl: st.avatar || '',
            template: 'default',
            batchId,
            version,
            generatedBy: req.user && req.user.sub,
            idCode,
            issueDate: reqIssueDate,
            validUpto: reqValidUpto
          });
          break;
        } catch (err) {
          if (String(err && err.code) === '11000') {
            // duplicate idCode - generate a fresh code and retry
            idCode = makeId('IDC_');
            continue;
          }
          throw err;
        }
      }
      if (created) out.push(created);
    }
    return res.json({
      batchId,
      count: out.length,
      cards: out
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Generate ID cards for all faculty
router.post("/generate-faculty", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const schoolName = req.body && req.body.schoolName || 'SCHOOL NAME';
    const reqIssueDate = req.body && req.body.issueDate ? new Date(req.body.issueDate) : new Date();
    const reqValidUpto = req.body && req.body.validUpto ? new Date(req.body.validUpto) : new Date(reqIssueDate.getTime() + 365 * 24 * 60 * 60 * 1000);
    const list = await Faculty.find({}).lean().catch(() => []);
    const batchId = `fac_${Date.now()}`;
    const out = [];
    for (const f of list) {
      let latest = null;
      try {
        latest = await IDCard.findOne({
          facultyId: f._id
        }).sort({
          version: -1,
          createdAt: -1
        }).lean().catch(() => null);
      } catch {}
      const version = latest ? Number(latest.version || 1) + 1 : 1;
      let idCode = latest && latest.idCode ? latest.idCode : makeId('IDF_');
      let created = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          created = await IDCard.create({
            facultyId: f._id,
            type: 'faculty',
            name: f.name || '',
            fatherName: '',
            rollNo: f.employeeId || '',
            gender: f.gender || '',
            class: '',
            section: '',
            contact: f.contact || '',
            email: f.email || '',
            designation: f.designation || f.subject || '',
            schoolName,
            photoUrl: f.avatar || '',
            template: 'default',
            batchId,
            version,
            generatedBy: req.user && req.user.sub,
            idCode,
            issueDate: reqIssueDate,
            validUpto: reqValidUpto
          });
          break;
        } catch (err) {
          if (String(err && err.code) === '11000') {
            // duplicate idCode
            idCode = makeId('IDF_');
            continue;
          }
          throw err;
        }
      }
      if (created) out.push(created);
    }
    return res.json({
      batchId,
      count: out.length,
      cards: out
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Generate ID cards for staff (users with role 'admin')
router.post("/generate-staff", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const schoolName = req.body && req.body.schoolName || 'SCHOOL NAME';
    const reqIssueDate = req.body && req.body.issueDate ? new Date(req.body.issueDate) : new Date();
    const reqValidUpto = req.body && req.body.validUpto ? new Date(req.body.validUpto) : new Date(reqIssueDate.getTime() + 365 * 24 * 60 * 60 * 1000);
    const list = await User.find({
      role: 'staff'
    }).lean().catch(() => []);
    const batchId = `stf_${Date.now()}`;
    const out = [];
    for (const u of list) {
      let latest = null;
      try {
        latest = await IDCard.findOne({
          userId: u._id
        }).sort({
          version: -1,
          createdAt: -1
        }).lean().catch(() => null);
      } catch {}
      const version = latest ? Number(latest.version || 1) + 1 : 1;
      let idCode = latest && latest.idCode ? latest.idCode : makeId('IDS_');
      const staffId = `STF-${String(u._id).slice(-6).toUpperCase()}`;
      let created = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          created = await IDCard.create({
            userId: u._id,
            type: 'staff',
            name: u.name || u.username || '',
            fatherName: '',
            rollNo: staffId,
            gender: u.gender || '',
            class: '',
            section: '',
            contact: u.contact || '',
            schoolName,
            photoUrl: u.avatar || '',
            template: 'default',
            batchId,
            version,
            generatedBy: req.user && req.user.sub,
            idCode,
            issueDate: reqIssueDate,
            validUpto: reqValidUpto,
            email: u.username || ''
          });
          break;
        } catch (err) {
          if (String(err && err.code) === '11000') {
            // duplicate idCode
            idCode = makeId('IDS_');
            continue;
          }
          throw err;
        }
      }
      if (created) out.push(created);
    }
    return res.json({
      batchId,
      count: out.length,
      cards: out
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Update an individual ID card (e.g., add/change photo or fields)
router.put("/:id", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const allowed = ['name', 'fatherName', 'rollNo', 'class', 'section', 'contact', 'email', 'designation', 'schoolName', 'photoUrl', 'template', 'issueDate', 'validUpto', 'medium', 'gender'];
    const patch = {};
    for (const k of allowed) if (req.body && Object.prototype.hasOwnProperty.call(req.body, k)) patch[k] = req.body[k];
    const doc = await IDCard.findByIdAndUpdate(id, {
      $set: patch
    }, {
      new: true
    }).lean().catch(() => null);
    if (!doc) return res.status(404).json({
      message: 'Card not found'
    });
    return res.json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// List latest ID cards for a class and section (default latest per student)
router.get("/", verifyToken, async (req, res) => {
  try {
    const {
      class: klass,
      section,
      latest = 'true'
    } = req.query || {};
    const filter = {};
    if (klass) filter.class = String(klass);
    if (section) filter.section = String(section);
    const list = await IDCard.find(filter).sort({
      createdAt: -1
    }).lean().catch(() => []);
    if (String(latest) !== 'false') {
      const map = new Map();
      for (const c of list) {
        const key = String(c.studentId);
        if (!map.has(key)) map.set(key, c);
      }
      return res.json(Array.from(map.values()));
    }
    return res.json(list);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Get batches summary (history) by class/section
router.get("/batches", verifyToken, async (req, res) => {
  try {
    const {
      class: klass,
      section
    } = req.query || {};
    const match = {};
    if (klass) match.class = String(klass);
    if (section) match.section = String(section);
    const agg = await IDCard.aggregate([{
      $match: match
    }, {
      $group: {
        _id: '$batchId',
        count: {
          $sum: 1
        },
        class: {
          $first: '$class'
        },
        section: {
          $first: '$section'
        },
        latestAt: {
          $max: '$createdAt'
        }
      }
    }, {
      $sort: {
        latestAt: -1
      }
    }]).catch(() => []);
    const rows = agg.map(a => ({
      batchId: a._id,
      count: a.count,
      class: a.class,
      section: a.section,
      date: a.latestAt
    }));
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Get cards by batch id
router.get("/by-batch/:batchId", verifyToken, async (req, res) => {
  try {
    const list = await IDCard.find({
      batchId: req.params.batchId
    }).sort({
      createdAt: -1
    }).lean().catch(() => []);
    return res.json(list);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Latest card for a student
router.get("/student/:studentId", verifyToken, async (req, res) => {
  try {
    const {
      studentId
    } = req.params;
    let doc = await IDCard.findOne({
      studentId
    }).sort({
      version: -1,
      createdAt: -1
    }).lean().catch(() => null);
    if (!doc) return res.status(404).json({
      message: 'No card found'
    });
    // Enrich house and houseRole from current Student if missing or empty
    try {
      if (!doc.house || !doc.houseRole) {
        const st = await Student.findById(studentId).lean().catch(() => null);
        if (st) {
          doc = {
            ...doc,
            house: doc.house || st.house || '',
            houseRole: doc.houseRole || st.houseRole || '',
            gender: doc.gender || st.gender || ''
          };
        }
      }
    } catch {}
    return res.json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Latest card for a faculty
router.get("/faculty/:facultyId", verifyToken, async (req, res) => {
  try {
    const {
      facultyId
    } = req.params;
    const doc = await IDCard.findOne({
      facultyId
    }).sort({
      version: -1,
      createdAt: -1
    }).lean().catch(() => null);
    if (!doc) return res.status(404).json({
      message: 'No card found'
    });
    return res.json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Latest card for a staff user
router.get("/staff/:userId", verifyToken, async (req, res) => {
  try {
    const {
      userId
    } = req.params;
    const doc = await IDCard.findOne({
      userId,
      type: 'staff'
    }).sort({
      version: -1,
      createdAt: -1
    }).lean().catch(() => null);
    if (!doc) return res.status(404).json({
      message: 'No card found'
    });
    return res.json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
// Backfill idCode for existing cards missing the code
router.post("/backfill-codes", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const cards = await IDCard.find({
      $or: [{
        idCode: {
          $exists: false
        }
      }, {
        idCode: null
      }, {
        idCode: ''
      }]
    }).lean().catch(() => []);
    let updated = 0;
    for (const c of cards) {
      const code = makeId('IDC_');
      await IDCard.updateOne({
        _id: c._id
      }, {
        $set: {
          idCode: code
        }
      }).catch(() => null);
      updated++;
    }
    return res.json({
      updated
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Verify ID card authenticity by code (public)
router.get("/verify/:code", async (req, res) => {
  try {
    const code = req.params && req.params.code;
    if (!code) return res.status(400).json({
      message: 'code required'
    });
    let doc = await IDCard.findOne({
      idCode: code
    }).lean().catch(() => null);
    if (!doc) return res.status(404).json({
      message: 'Invalid code'
    });

    // Derive type if missing based on idCode prefix
    let derivedType = doc.type;
    if (!derivedType || derivedType === '') {
      if (String(code).startsWith('IDF_')) derivedType = 'faculty';else if (String(code).startsWith('IDS_')) derivedType = 'staff';else derivedType = 'student';
    }

    // Enrich missing fields based on type/owner document
    if (derivedType === 'student' && doc.studentId) {
      try {
        const st = await Student.findById(doc.studentId).lean().catch(() => null);
        if (st) {
          if (!doc.house) doc.house = st.house || '';
          if (!doc.houseRole) doc.houseRole = st.houseRole || '';
          if (!doc.photoUrl && st.avatar) doc.photoUrl = st.avatar;
          if (!doc.name && st.name) doc.name = st.name;
          if (!doc.rollNo && st.rollNo) doc.rollNo = st.rollNo;
          if (!doc.class && st.class) doc.class = st.class;
          if (!doc.section && st.section) doc.section = st.section;
          if (!doc.gender && st.gender) doc.gender = st.gender;
        }
      } catch {}
    }
    if (derivedType === 'faculty' && doc.facultyId) {
      try {
        const f = await Faculty.findById(doc.facultyId).lean().catch(() => null);
        if (f) {
          if (!doc.photoUrl && f.avatar) doc.photoUrl = f.avatar;
          if (!doc.name && f.name) doc.name = f.name;
          if (!doc.rollNo && f.employeeId) doc.rollNo = f.employeeId;
          if (!doc.designation && (f.designation || f.subject)) doc.designation = f.designation || f.subject;
          if (!doc.email && f.email) doc.email = f.email;
          // If still no photo, try User avatar linked by faculty email
          if (!doc.photoUrl && f.email) {
            try {
              const u = await User.findOne({
                role: 'faculty',
                username: f.email
              }).lean().catch(() => null);
              if (u && u.avatar) doc.photoUrl = u.avatar;
            } catch {}
          }
        }
      } catch {}
    }
    if (derivedType === 'staff' && doc.userId) {
      try {
        const u = await User.findById(doc.userId).lean().catch(() => null);
        if (u) {
          if (!doc.photoUrl && u.avatar) doc.photoUrl = u.avatar;
          if (!doc.name && (u.name || u.username)) doc.name = u.name || u.username;
        }
      } catch {}
    }
    return res.json({
      ...doc,
      type: derivedType
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Simple in-memory SSE clients list for admin notification stream

  return router;
};
