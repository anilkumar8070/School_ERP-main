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

// ===================== Test Results APIs (student & admin/faculty) =====================
// Get current authenticated student's test results

// Get test results by student id (admin/faculty)

// Set or clear a student's house role (e.g., Captain/Leader)

// Bulk change house for many students at once

// Generic file upload endpoint - returns public URL for uploaded file

// ===================== ID Card APIs =====================
// Generate ID cards for a class & section in one batch

// Generate ID cards for all faculty

// Generate ID cards for staff (users with role 'admin')

// Update an individual ID card (e.g., add/change photo or fields)

// List latest ID cards for a class and section (default latest per student)

// Get batches summary (history) by class/section

// Get cards by batch id

// Latest card for a student

// Latest card for a faculty

// Latest card for a staff user

// Backfill idCode for existing cards missing the code

// Verify ID card authenticity by code (public)
router.get("/results/my", verifyToken, async (req, res) => {
  try {
    // Expect student role; still allow parent/admin to fetch by their linked student later if needed
    const userId = req.user && req.user.sub;
    if (!userId) return res.status(401).json({
      message: 'Not authenticated'
    });

    // Find student record for this user
    let student = null;
    try {
      student = await prisma.student.findUnique({
        where: {
          id: String(userId)
        }
      }).catch(() => null);
    } catch {}
    const filter = {};
    if (student) {
      filter.studentId = (student.id || student._id);
    } else {
      let u = null;
      try {
        u = await prisma.user.findUnique({
          where: {
            id: String(userId)
          }
        }).catch(() => null);
      } catch {}
      if (u && u.username) filter.email = u.username;
    }
    const list = await prisma.testResult.findMany({
      where: filter,

      orderBy: [{
        submittedAt: "desc"
      }, {
        createdAt: "desc"
      }]
    }).catch(() => []);
    return res.json(list);
  } catch (e) {
    return res.status(500).json({
      message: e.message || 'Failed to load my test results'
    });
  }
});
router.get("/results/by-student/:studentId", verifyToken, async (req, res) => {
  try {
    const {
      studentId
    } = req.params;
    if (!studentId) return res.status(400).json({
      message: 'studentId required'
    });
    const list = await prisma.testResult.findMany({
      where: {
        studentId
      },

      orderBy: [{
        submittedAt: "desc"
      }, {
        createdAt: "desc"
      }]
    }).catch(() => []);
    return res.json(list);
  } catch (e) {
    return res.status(500).json({
      message: e.message || 'Failed to load test results'
    });
  }
});
// Test Management
// Create a test series (admin or faculty). Supports optional file upload (e.g., CSV or resources)
router.post("/", verifyToken, requireRole(['admin', 'faculty']), upload.single('file'), async (req, res) => {
  try {
    const {
      title,
      subject,
      term,
      type = 'google_form',
      link,
      classes,
      sections,
      start,
      durationMinutes,
      attempts,
      description
    } = req.body || {};
    if (!title) return res.status(400).json({
      message: 'title required'
    });
    // require durationMinutes (must be a positive number)
    const dur = durationMinutes ? Number(durationMinutes) : null;
    if (!dur || isNaN(dur) || dur <= 0) return res.status(400).json({
      message: 'durationMinutes required and must be a positive number'
    });
    const cls = Array.isArray(classes) ? classes : classes ? String(classes).split(',').map(s => s.trim()).filter(Boolean) : [];
    const secs = Array.isArray(sections) ? sections : sections ? String(sections).split(',').map(s => s.trim()).filter(Boolean) : [];
    const file = req.file;
    const filePath = file ? `/uploads/${file.filename}` : '';
    if (false) {
      // create in-memory test for development without DB
      const t = {
        _id: makeId('t_'),
        title,
        subject: subject || '',
        term: term || 'Term 1',
        type,
        link: link || '',
        filePath,
        classes: cls,
        sections: secs,
        start: start ? new Date(start) : null,
        durationMinutes: Number(durationMinutes),
        attempts: attempts ? Number(attempts) : 1,
        description: description || '',
        createdBy: req.user.sub,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      inMemoryTests.push(t);
      return res.status(201).json(t);
    }
    const doc = await TestSeries.create({
      data: {
        title,
        subject: subject || '',
        term: term || 'Term 1',
        type,
        link: link || '',
        filePath,
        classes: cls,
        sections: secs,
        start: start ? new Date(start) : null,
        durationMinutes: Number(durationMinutes),
        attempts: attempts ? Number(attempts) : 1,
        description: description || '',
        createdBy: req.user.sub
      }
    });
    return res.status(201).json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: list all tests
router.get("/", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    if (false) return res.json(inMemoryTests);
    const items = await prisma.testSeries.findMany({
      orderBy: {
        start: "desc"
      }
    , include: { createdBy: { select: { name: true, role: true } } }});
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Update a test series (admin or faculty). Faculty may only update tests they created.
router.put("/:id", verifyToken, requireRole(['admin', 'faculty']), async (req, res) => {
  try {
    if (false) return res.status(503).json({
      message: 'Database not available'
    });
    const id = req.params.id;
    const t = await prisma.testSeries.findUnique({
      where: {
        id: String(id)
      }
    });
    if (!t) return res.status(404).json({
      message: 'Test series not found'
    });

    // If faculty, ensure they are the creator
    if (req.user.role === 'faculty' && (!t.createdBy || String(t.createdBy) !== String(req.user.sub))) {
      return res.status(403).json({
        message: 'Forbidden'
      });
    }
    const allowed = ['title', 'subject', 'term', 'type', 'link', 'filePath', 'classes', 'sections', 'start', 'durationMinutes', 'attempts', 'description'];
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        // normalize arrays for classes/sections
        if ((k === 'classes' || k === 'sections') && Array.isArray(req.body[k])) t[k] = req.body[k];else if ((k === 'classes' || k === 'sections') && typeof req.body[k] === 'string') t[k] = String(req.body[k]).split(',').map(s => s.trim()).filter(Boolean);else if (k === 'durationMinutes' || k === 'attempts') t[k] = Number(req.body[k] || 0);else if (k === 'start') t[k] = req.body[k] ? new Date(req.body[k]) : null;else t[k] = req.body[k];
      }
    }
    // Transpiled save()
    if (t) {
      const { id: _unused_id, _id: _unused__id, save: _unused_save, toObject: _unused_toObject, ..._updateData } = t;
      
      // Clean out relational arrays if any to prevent Prisma crash
      for (const k in _updateData) {
        if (Array.isArray(_updateData[k]) && _updateData[k].length > 0 && typeof _updateData[k][0] === 'object') {
           delete _updateData[k];
        }
      }

      await prisma.testSeries.update({
        where: { id: String((t.id || t._id)) },
        data: _updateData
      }).catch(e => console.error("Transpiled save error:", e.message));
    }
    return res.json(t);
  } catch (e) {
    return res.status(500).json({
      message: e && e.message ? e.message : String(e)
    });
  }
});

// Delete a test series (admin or faculty who created it)
router.delete("/:id", verifyToken, requireRole(['admin', 'faculty']), async (req, res) => {
  try {
    const id = req.params.id;
    if (false) {
      // remove from in-memory tests
      const idx = inMemoryTests.findIndex(t => String((t.id || t._id)) === String(id));
      if (idx === -1) return res.status(404).json({
        message: 'Test series not found'
      });
      // if faculty, ensure they created it (in-memory items may not have createdBy)
      const role = req.user && req.user.role;
      if (role === 'faculty') {
        const it = inMemoryTests[idx];
        if (it.createdBy && String(it.createdBy) !== String(req.user.sub)) return res.status(403).json({
          message: 'Forbidden'
        });
      }
      inMemoryTests.splice(idx, 1);
      return res.json({
        message: 'Deleted'
      });
    }
    const t = await prisma.testSeries.findUnique({
      where: {
        id: String(id)
      }
    });
    if (!t) return res.status(404).json({
      message: 'Test series not found'
    });

    // If faculty, ensure they are the creator
    if (req.user.role === 'faculty' && (!t.createdBy || String(t.createdBy) !== String(req.user.sub))) {
      return res.status(403).json({
        message: 'Forbidden'
      });
    }

    // delete related questions and results, then delete the test document
    await Question.deleteMany({ where: {
      testId: id
    } }).catch(() => {});
    await TestResult.deleteMany({ where: {
      test: id
    } }).catch(() => {});
    await TestSeries.deleteMany({ where: {
      id: id
    } }).catch(() => {});
    return res.json({
      message: 'Deleted'
    });
  } catch (e) {
    return res.status(500).json({
      message: e && e.message ? e.message : String(e)
    });
  }
});

// Get tests relevant to the requesting user (faculty/admin see created or all, students see assigned)
router.get("/my", verifyToken, async (req, res) => {
  try {
    const role = req.user.role || 'student';
    if (false) {
      // Development mode: return in-memory tests for everyone so students can try the flow
      return res.json(inMemoryTests);
    }
    if (role === 'admin') {
      const items = await prisma.testSeries.findMany({
        orderBy: {
          start: "desc"
        }
      });
      // enrich with totalQuestions
      try {
        const counts = await Promise.all((items || []).map(it => prisma.question.count({
          where: {
            testId: (it.id || it._id)
          }
        }).catch(() => 0)));
        (items || []).forEach((it, i) => {
          it.totalQuestions = counts[i] || 0;
        });
      } catch (e) {/* ignore counts errors */}
      return res.json(items);
    }
    if (role === 'faculty') {
      const items = await prisma.testSeries.findMany({
        where: {
          OR: [{
            createdBy: req.user.sub
          }]
        },

        orderBy: {
          start: "desc"
        }
      });
      try {
        const counts = await Promise.all((items || []).map(it => prisma.question.count({
          where: {
            testId: (it.id || it._id)
          }
        }).catch(() => 0)));
        (items || []).forEach((it, i) => {
          it.totalQuestions = counts[i] || 0;
        });
      } catch (e) {}
      return res.json(items);
    }
    // student: return tests assigned to student's class/section or to all (classes=[] means all)
    const userEmail = req.user.username;
    const studentDoc = await prisma.student.findFirst({
      where: {
        email: userEmail
      }
    }).catch(() => null);
    const now = new Date();
    const q = {};
    // optional: only upcoming or recent tests; for now return all assigned
    const orClauses = [];
    // tests with no classes (target all students)
    orClauses.push({
      classes: {
        $size: 0
      }
    });
    orClauses.push({
      classes: null
    });
    if (studentDoc) {
      orClauses.push({
        classes: studentDoc.class
      });
      orClauses.push({
        classes: {
          in: [studentDoc.class]
        }
      });
      if (studentDoc.section) {
        orClauses.push({
          sections: {
            in: [studentDoc.section]
          }
        });
        orClauses.push({
          sections: studentDoc.section
        });
      }
    }
    q.OR = orClauses;
    const items = await prisma.testSeries.findMany({
      where: q,

      orderBy: {
        start: "asc"
      }
    });
    try {
      const counts = await Promise.all((items || []).map(it => prisma.question.count({
        where: {
          testId: (it.id || it._id)
        }
      }).catch(() => 0)));
      (items || []).forEach((it, i) => {
        it.totalQuestions = counts[i] || 0;
      });
    } catch (e) {}
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Get results for a test (admin or faculty)
router.get("/:id/results", verifyToken, requireRole(['admin', 'faculty']), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const testId = req.params.id;
    // If faculty, ensure they created the test
    if (req.user.role === 'faculty') {
      const testDoc = await prisma.testSeries.findUnique({
        where: {
          id: String(testId)
        }
      });
      if (!testDoc) return res.status(404).json({
        message: 'Test not found'
      });
      if (!testDoc.createdBy || String(testDoc.createdBy) !== String(req.user.sub)) return res.status(403).json({
        message: 'Forbidden'
      });
    }
    const items = await prisma.testResult.findMany({
      where: {
        test: testId
      },

      orderBy: {
        submittedAt: "desc"
      }
    });
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Subjective review routes removed (feature deleted)

// Return questions for a test - allow student, admin and faculty (do not expose correct answers to students)
// Admins/faculty can also fetch questions for management purposes; correct answers are not included here.
router.get("/:id/questions", verifyToken, requireRole(['student', 'admin', 'faculty']), async (req, res) => {
  try {
    const testId = req.params.id;
    // Allow admin/faculty to fetch questions for management — skip availability/attempt checks for them
    const now = new Date();
    const startedParam = String(req.query && req.query.started || '').toLowerCase() === 'true';
    if (true) {
      const tdoc = await prisma.testSeries.findUnique({
        where: {
          id: String(testId)
        }
      });
      if (!tdoc) return res.status(404).json({
        message: 'Test not found'
      });
      const userRole = req.user && req.user.role;
      // If not admin/faculty, enforce start/end and attempt rules
      if (!(userRole === 'admin' || userRole === 'faculty')) {
        // Allow a student to initiate their attempt (per-student start) by passing ?started=true
        // If startedParam is true, treat the student's start time as now (override test-level start)
        let start = tdoc.start ? new Date(tdoc.start) : null;
        if (startedParam) start = now;
        if (start) {
          if (now < start) return res.status(403).json({
            message: 'Test has not started yet'
          });
          if (tdoc.durationMinutes) {
            const end = new Date(start.getTime() + Number(tdoc.durationMinutes) * 60000);
            if (now > end) return res.status(403).json({
              message: 'Test has ended'
            });
          }
        }

        // check if student already submitted
        const username = req.user && req.user.username;
        const studentDoc = await prisma.student.findFirst({
          where: {
            email: username
          }
        }).catch(() => null);
        // count previous attempts and compare to allowed attempts on the test
        const allowedAttempts = tdoc.attempts ? Number(tdoc.attempts) : 1;
        let attemptsCount = 0;
        if (true) {
          attemptsCount = await prisma.testResult.count({
            where: {
              test: testId,
              OR: [{
                email: username
              }, {
                studentId: studentDoc && (studentDoc.id || studentDoc._id)
              }]
            }
          }).catch(() => 0);
        } else {
          attemptsCount = inMemoryTestsResults.filter(r => String(r.test) === String(testId) && (r.email === username || String(r.studentId) === String(studentDoc && (studentDoc.id || studentDoc._id)))).length;
        }
        if (attemptsCount >= allowedAttempts) return res.status(403).json({
          message: 'You have already attempted this test'
        });
      }
      const qs = await prisma.question.findMany({
        where: {
          testId
        }
      });
      const out = (qs || []).map(q => {
        // For admin/faculty include correctAnswer and explanation so they can manage questions.
        if (userRole === 'admin' || userRole === 'faculty') {
          return {
            _id: (q.id || q._id),
            questionText: q.questionText,
            questionImage: q.questionImage || '',
            options: q.options,
            optionImages: Array.isArray(q.optionImages) ? q.optionImages : [],
            marks: q.marks,
            correctAnswer: q.correctAnswer || '',
            explanation: q.explanation || ''
          };
        }
        // Students do not receive correctAnswer/explanation
        return {
          _id: (q.id || q._id),
          questionText: q.questionText,
          questionImage: q.questionImage || '',
          options: q.options,
          optionImages: Array.isArray(q.optionImages) ? q.optionImages : [],
          marks: q.marks
        };
      });
      return res.json(out);
    } else {
      const qs = inMemoryQuestions.filter(q => String(q.testId) === String(testId));
      const out = qs.map(q => ({
        _id: (q.id || q._id),
        questionText: q.questionText,
        options: q.options,
        marks: q.marks
      }));
      return res.json(out);
    }
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Student submits answers for a test; server grades and stores a TestResult
router.post("/:id/submit", verifyToken, requireRole('student'), async (req, res) => {
  try {
    const testId = req.params.id;
    const {
      answers,
      candidate
    } = req.body || {};
    if (!Array.isArray(answers)) return res.status(400).json({
      message: 'answers array required'
    });

    // check test availability and duplicate submission
    const now = new Date();
    if (true) {
      const tdoc = await prisma.testSeries.findUnique({
        where: {
          id: String(testId)
        }
      });
      if (!tdoc) return res.status(404).json({
        message: 'Test not found'
      });
      // Support per-student start when client indicates they started the test (body.isStarted===true)
      const startedBody = req.body && req.body.isStarted;
      let start = tdoc.start ? new Date(tdoc.start) : null;
      if (startedBody) start = now;
      if (start) {
        if (now < start) return res.status(403).json({
          message: 'Test has not started yet'
        });
        if (tdoc.durationMinutes) {
          const end = new Date(start.getTime() + Number(tdoc.durationMinutes) * 60000);
          // allow a small grace window (12s) for finalisation/auto-submit
          const graceMs = 12000;
          if (now > new Date(end.getTime() + graceMs)) return res.status(403).json({
            message: 'Test has ended'
          });
        }
      }
      const username = req.user && req.user.username;
      const studentDoc = await prisma.student.findFirst({
        where: {
          email: username
        }
      }).catch(() => null);
      // count previous attempts and allow submission only if attempts < allowed
      const allowedAttempts2 = tdoc.attempts ? Number(tdoc.attempts) : 1;
      let prevCount = 0;
      if (true) {
        prevCount = await prisma.testResult.count({
          where: {
            test: testId,
            OR: [{
              email: username
            }, {
              studentId: studentDoc && (studentDoc.id || studentDoc._id)
            }]
          }
        }).catch(() => 0);
      } else {
        prevCount = inMemoryTestsResults.filter(r => String(r.test) === String(testId) && (r.email === username || String(r.studentId) === String(studentDoc && (studentDoc.id || studentDoc._id)))).length;
      }
      if (prevCount >= allowedAttempts2) return res.status(403).json({
        message: 'You have already submitted this test'
      });
    }

    // load questions
    let qs = [];
    if (false) {
      qs = inMemoryQuestions.filter(q => String(q.testId) === String(testId));
    } else {
      qs = await prisma.question.findMany({
        where: {
          testId
        }
      });
    }
    if (!qs || !qs.length) return res.status(400).json({
      message: 'No questions found for this test'
    });

    // build map
    const qmap = {};
    let totalMarks = 0;
    for (const q of qs) {
      qmap[String((q.id || q._id))] = q;
      totalMarks += Number(q.marks || 1);
    }
    let score = 0;
    const details = [];
    let hasSubjective = false;
    for (const a of answers) {
      const qid = String(a.questionId || a.q || '');
      const ans = a.answer || a.selected || '';
      const q = qmap[qid];
      if (!q) continue;
      const correct = q.correctAnswer || '';
      const opts = Array.isArray(q.options) ? q.options.filter(Boolean) : [];
      let awarded = 0;
      let matched = false;
      let matchedPercentage = null;
      if (opts && opts.length) {
        // MCQ: exact match (case-insensitive)
        matched = String(ans || '').trim().toLowerCase() === String(correct || '').trim().toLowerCase();
        if (matched) awarded = Number(q.marks || 1);
      } else {
        hasSubjective = true;
        // Subjective: compute similarity (enhanced: char + word-level)
        const sim = enhancedSimilarity(ans, correct); // 0..1
        matchedPercentage = Math.round(sim * 10000) / 100;
        if (SUBJECTIVE_SCORING === 'binary') {
          matched = sim >= SUBJECTIVE_THRESHOLD;
          awarded = matched ? Number(q.marks || 1) : 0;
        } else {
          // proportional
          awarded = Math.round(sim * Number(q.marks || 1) * 100) / 100;
          matched = sim >= SUBJECTIVE_THRESHOLD;
        }
        // if correctAnswer is empty, treat as 0
        if (!String(correct || '').trim()) {
          matchedPercentage = 0;
          awarded = 0;
          matched = false;
        }
      }
      score += Number(awarded || 0);
      const detail = {
        questionId: qid,
        questionText: q.questionText || '',
        given: ans,
        correctAnswer: correct,
        marks: q.marks || 1,
        correct: matched,
        awardedMarks: Number(awarded || 0)
      };
      if (matchedPercentage !== null) detail.matchedPercentage = matchedPercentage;
      // debug: include raw block (question text) when match is low or missing
      if (matchedPercentage === null || matchedPercentage < DEBUG_MATCH_THRESHOLD) {
        detail.rawBlock = q.questionText || '';
        console.debug('Low match for question', qid, {
          questionText: q.questionText || '',
          given: ans,
          matchedPercentage
        });
      }
      details.push(detail);
    }
    const percentage = totalMarks ? Math.round(score / totalMarks * 100 * 100) / 100 : null;

    // student info
    const username = req.user && req.user.username;
    let studentDoc = null;
    if (true) {
      studentDoc = await prisma.student.findFirst({
        where: {
          email: username
        }
      }).catch(() => null);
    }

    // try to include test title and subject for email/raw
    let testTitle = '';
    let testSubject = '';
    try {
      if (true) {
        const tdoc = await prisma.testSeries.findUnique({
          where: {
            id: String(testId)
          }
        }).catch(() => null);
        if (tdoc && tdoc.title) testTitle = tdoc.title;
        if (tdoc && tdoc.subject) testSubject = tdoc.subject;
      } else {
        const tdoc = inMemoryTests.find(t => String((t.id || t._id)) === String(testId));
        if (tdoc) {
          testTitle = tdoc.title;
          testSubject = tdoc.subject || '';
        }
      }
    } catch (e) {}
    const wasAuto = req.body && req.body.isAuto === true;
    const resultPayload = {
      test: true ? testId : testId,
      studentId: studentDoc && (studentDoc.id || studentDoc._id) ? (studentDoc.id || studentDoc._id) : undefined,
      name: studentDoc && studentDoc.name ? studentDoc.name : req.user && req.user.name || '',
      email: username || '',
      rollNo: studentDoc && studentDoc.rollNo ? studentDoc.rollNo : '',
      class: studentDoc && studentDoc.class ? studentDoc.class : '',
      section: studentDoc && studentDoc.section ? studentDoc.section : '',
      score,
      total: totalMarks,
      percentage,
      submittedAt: new Date(),
      raw: Object.assign({
        answers: details,
        testTitle,
        subject: testSubject
      }, candidate ? {
        candidate
      } : {}, wasAuto ? {
        autoSubmitted: true
      } : {}),
      autoSubmitted: wasAuto === true ? true : false,
      pendingReview: hasSubjective === true ? true : false,
      status: hasSubjective === true ? 'pending' : 'final'
    };
    let created = null;
    if (false) {
      created = Object.assign({
        _id: makeId('r_'),
        createdAt: new Date(),
        updatedAt: new Date()
      }, resultPayload);
      inMemoryTestsResults = inMemoryTestsResults || [];
      inMemoryTestsResults.push(created);
    } else {
      try {
        created = await prisma.testResult.create({ data: resultPayload });
      } catch (createErr) {
        // handle duplicate insertion race (unique index on test+studentId or test+email)
        if (createErr && createErr.code === 'P2002') {
          try {
            const usernameKey = resultPayload.email || '';
            const existing = await prisma.testResult.findFirst({
              where: {
                test: testId,
                OR: [{
                  email: usernameKey
                }, {
                  studentId: resultPayload.studentId
                }]
              }
            }).catch(() => null);
            if (existing) {
              created = existing;
            } else {
              // if we cannot find, rethrow to let outer handler respond
              throw createErr;
            }
          } catch (inner) {
            throw inner;
          }
        } else {
          throw createErr;
        }
      }
    }

    // send email to student if email present and not pending review
    try {
      if (created && created.email && !created.pendingReview) {
        const subj = `Test result: ${created.raw && created.raw.testTitle ? created.raw.testTitle : String(created.test || '')}`;
        const html = `<p>Hello ${created.name || ''},</p><p>Your test has been evaluated.</p><p>Score: ${created.score} / ${created.total} (${created.percentage != null ? created.percentage + '%' : ''})</p>`;
        await sendMail({
          to: created.email,
          subject: subj,
          html
        }).catch(() => {});
      }
    } catch (mailErr) {/* ignore */}
    return res.json({
      ok: true,
      result: created
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Student forfeits test (e.g., leaves tab/window) — create a zero-score TestResult
router.post("/:id/forfeit", verifyToken, requireRole('student'), async (req, res) => {
  try {
    const testId = req.params.id;
    if (false) return res.status(503).json({
      message: 'Database not available'
    });
    const username = req.user && req.user.username;
    const studentDoc = await prisma.student.findFirst({
      where: {
        email: username
      }
    }).catch(() => null);
    // check if already submitted
    const prev = await prisma.testResult.findFirst({
      where: {
        test: testId,
        OR: [{
          email: username
        }, {
          studentId: studentDoc && (studentDoc.id || studentDoc._id)
        }]
      }
    }).catch(() => null);
    if (prev) return res.status(403).json({
      message: 'You have already submitted this test'
    });

    // compute total marks from questions
    const qs = await prisma.question.findMany({
      where: {
        testId
      }
    }).catch(() => []);
    let totalMarks = 0;
    for (const q of qs) totalMarks += Number(q.marks || 1);

    // include test subject if available
    let testSubject = '';
    try {
      const tdoc = await prisma.testSeries.findUnique({
        where: {
          id: String(testId)
        }
      }).catch(() => null);
      if (tdoc && tdoc.subject) testSubject = tdoc.subject;
    } catch (e) {}
    const resultPayload = {
      test: testId,
      studentId: studentDoc && (studentDoc.id || studentDoc._id) ? (studentDoc.id || studentDoc._id) : undefined,
      name: studentDoc && studentDoc.name ? studentDoc.name : req.user && req.user.name || '',
      email: username || '',
      rollNo: studentDoc && studentDoc.rollNo ? studentDoc.rollNo : '',
      class: studentDoc && studentDoc.class ? studentDoc.class : '',
      section: studentDoc && studentDoc.section ? studentDoc.section : '',
      score: 0,
      total: totalMarks || null,
      percentage: totalMarks ? 0 : null,
      submittedAt: new Date(),
      raw: {
        forfeited: true,
        subject: testSubject
      }
    };
    const created = await prisma.testResult.create({ data: resultPayload });
    return res.json({
      ok: true,
      result: created
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Upload bulk results as CSV and import into TestResult docs (admin/faculty)
router.post("/:id/results/upload", verifyToken, requireRole(['admin', 'faculty']), upload.single('file'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const testId = req.params.id;
    const file = req.file;
    if (!file) return res.status(400).json({
      message: 'CSV file required'
    });
    const fp = path.join(uploadsDir, file.filename);
    const content = fs.readFileSync(fp, 'utf8');
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return res.status(400).json({
      message: 'CSV file is empty'
    });
    const header = lines[0].split(',').map(h => h.trim());
    // attempt to fetch test subject and attach it to each imported row
    let testSubject = '';
    try {
      const tdoc = await prisma.testSeries.findUnique({
        where: {
          id: String(testId)
        }
      }).catch(() => null);
      if (tdoc && tdoc.subject) testSubject = tdoc.subject;
    } catch (e) {}
    const results = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const obj = {};
      for (let j = 0; j < header.length; j++) {
        obj[header[j]] = cols[j] !== undefined ? cols[j].trim() : '';
      }
      const score = obj.score ? Number(obj.score) : obj.marks ? Number(obj.marks) : null;
      const total = obj.total ? Number(obj.total) : null;
      const percentage = obj.percentage ? Number(obj.percentage) : score !== null && total ? Math.round(score / total * 100 * 100) / 100 : null;
      const submittedAt = obj.submittedAt ? new Date(obj.submittedAt) : new Date();
      const r = {
        test: testId,
        name: obj.name || obj.student || obj.fullName || '',
        email: obj.email || '',
        rollNo: obj.rollNo || obj.roll || obj.roll_no || '',
        class: obj.class || obj.Class || '',
        section: obj.section || '',
        score: score,
        total: total,
        percentage: percentage,
        submittedAt: submittedAt,
        raw: obj
      };
      // ensure raw.subject contains the test's subject (prefer CSV value if provided)
      try {
        r.raw = r.raw || {};
        if (!r.raw.subject) r.raw.subject = testSubject;
      } catch (e) {}
      results.push(r);
    }
    // insert many
    const inserted = await prisma.testResult.createMany({ data: results });
    return res.json(inserted);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Parent/Admin: get test results for a specific student
router.get("/results/by-student/:id", verifyToken, requireRole(['parent', 'admin']), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const studentId = req.params.id;
    if (!studentId) return res.status(400).json({
      message: 'student id required'
    });
    const items = await prisma.testResult.findMany({
      where: {
        OR: [{
          studentId
        }, {
          studentId: new ($1)
        }]
      },

      orderBy: {
        submittedAt: "desc"
      }
    });
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Student: submit an assignment answer (file optional)

// Bulk test creation from a .docx file (parses questions/options/answers/marks)
router.post("/bulk", verifyToken, requireRole(['admin', 'faculty']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({
      message: 'file (docx) required'
    });
    if (!mammoth) return res.status(500).json({
      message: 'Server missing dependency: mammoth. Run `npm install mammoth` in backend.'
    });
    const {
      title,
      description,
      classes,
      sections,
      start,
      durationMinutes,
      term
    } = req.body || {};
    if (!title) return res.status(400).json({
      message: 'title required'
    });
    const fp = path.join(uploadsDir, req.file.filename);
    const ext = String(path.extname(fp) || '').toLowerCase();
    let text = '';
    if (ext === '.pdf') {
      if (!pdfParse) return res.status(500).json({
        message: 'Server missing dependency: pdf-parse. Run `npm install pdf-parse` in backend to support PDF parsing.'
      });
      const dataBuffer = fs.readFileSync(fp);
      const pdfRes = await pdfParse(dataBuffer);
      text = pdfRes && pdfRes.text ? String(pdfRes.text) : '';
    } else {
      if (!mammoth) return res.status(500).json({
        message: 'Server missing dependency: mammoth. Run `npm install mammoth` in backend.'
      });
      const data = await mammoth.extractRawText({
        path: fp
      });
      text = data && data.value ? String(data.value) : '';
    }
    if (!text) return res.status(400).json({
      message: 'Empty or unreadable document'
    });

    // build blocks by detecting question-start lines (e.g. "Q1.", "1.")
    const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
    const blocks = [];
    let current = [];
    const questionStartRegex = /^\s*(?:Q\s*\d+\.?|\d+\.)/i;
    for (const line of rawLines) {
      if (questionStartRegex.test(line) && current.length) {
        blocks.push(current.join('\n'));
        current = [line];
      } else {
        current.push(line);
      }
    }
    if (current.length) blocks.push(current.join('\n'));
    const questions = [];
    const optPrefix = /^[A-Da-d][)\.|\-]\s*/;
    const optionLineRegex = /^([A-Da-d]|\d+)\s*[\)\.\-]\s*(.*)$/;
    // allow forms like "Correct Option : C" or "Correct Answer : Washington DC"
    const answerLineRegex = /(answer|ans|correct)(?:\s*\w*)*\s*[:\-]?\s*([A-Za-z0-9 ]+)/i;
    const marksRegex = /(\d+)\s*(marks|mark|mks)/i;
    for (const block of blocks) {
      const lines = String(block).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (!lines.length) continue;

      // find first option line index
      let firstOptIdx = lines.findIndex(l => optionLineRegex.test(l) || optPrefix.test(l));
      if (firstOptIdx === -1) {
        // maybe single-line question without options — skip
        continue;
      }

      // question text is lines before firstOptIdx
      const qText = lines.slice(0, firstOptIdx).join(' ');
      const optionLines = [];
      for (let i = firstOptIdx; i < lines.length; i++) {
        const ln = lines[i];
        if (optionLineRegex.test(ln)) {
          const m = ln.match(optionLineRegex);
          optionLines.push(m[2].trim());
        } else if (optPrefix.test(ln)) {
          optionLines.push(ln.replace(optPrefix, '').trim());
        } else {
          // stop options if we hit an answer/marks line
          if (answerLineRegex.test(ln) || marksRegex.test(ln)) break;
        }
      }
      if (!optionLines.length) continue;

      // find answer in block — be permissive to match lines like
      // "Correct Answer option : A" or "Correct Answer : A"
      let correct = null;
      const postLines = lines.slice(firstOptIdx + optionLines.length);
      for (const l of postLines) {
        let a = null;
        const am = l.match(answerLineRegex);
        if (am && am[2]) {
          a = String(am[2]).trim();
        } else if (/correct/i.test(l)) {
          // try to find a trailing letter or number in the same line
          const m = l.match(/([A-Da-d]|\d+)\b/g);
          if (m && m.length) a = m[m.length - 1];
        }
        if (a) {
          // if letter, map to option
          if (/^[A-Da-d]$/.test(a)) {
            const idx = a.toUpperCase().charCodeAt(0) - 65;
            if (optionLines[idx]) correct = optionLines[idx];
          } else if (/^\d+$/.test(a)) {
            const idx = Number(a) - 1;
            if (optionLines[idx]) correct = optionLines[idx];
          } else {
            // try to match by option text
            const found = optionLines.find(opt => opt.toLowerCase().includes(String(a).toLowerCase()));
            if (found) correct = found;
          }
        }
        if (correct) break;
        // also detect inline markers like '(correct)' inside remaining lines
        if (/\(correct\)|\*correct\*|\*\s*\(|\(ans\)/i.test(l)) {
          for (const opt of optionLines) {
            if (/\(correct\)|\*correct\*|\*\s*$|\(ans\)/i.test(opt)) {
              correct = opt.replace(/\(correct\)|\*correct\*|\*|\(ans\)/ig, '').trim();
              break;
            }
          }
          if (correct) break;
        }
      }

      // If not found in postLines, search the entire block for variants like "Correct Option : A"
      if (!correct) {
        for (const l of lines) {
          let a = null;
          const am = l.match(answerLineRegex);
          if (am && am[2]) a = String(am[2]).trim();else if (/correct/i.test(l)) {
            const m = l.match(/([A-Da-d]|\d+)\b/g);
            if (m && m.length) a = m[m.length - 1];
          }
          if (a) {
            if (/^[A-Da-d]$/.test(a)) {
              const idx = a.toUpperCase().charCodeAt(0) - 65;
              if (optionLines[idx]) {
                correct = optionLines[idx];
                break;
              }
            } else if (/^\d+$/.test(a)) {
              const idx = Number(a) - 1;
              if (optionLines[idx]) {
                correct = optionLines[idx];
                break;
              }
            } else {
              const found = optionLines.find(opt => opt.toLowerCase().includes(String(a).toLowerCase()));
              if (found) {
                correct = found;
                break;
              }
            }
          }
        }
      }

      // if not found, search options for '(correct)' or '*' markers
      if (!correct) {
        for (const opt of optionLines) {
          if (/\(correct\)|\*correct\*|\*\s*$/.test(opt) || /\(ans\)/i.test(opt)) {
            correct = opt.replace(/\(correct\)|\*correct\*|\*|\(ans\)/ig, '').trim();
            break;
          }
        }
      }

      // marks for question (search whole block)
      let marks = 1;
      const mk = block.match(marksRegex);
      if (mk) marks = Number(mk[1]) || 1;
      questions.push({
        questionText: qText,
        options: optionLines,
        correctAnswer: correct,
        marks
      });
    }

    // create TestSeries doc
    const cls = Array.isArray(classes) ? classes : classes ? String(classes).split(',').map(s => s.trim()).filter(Boolean) : [];
    const secs = Array.isArray(sections) ? sections : sections ? String(sections).split(',').map(s => s.trim()).filter(Boolean) : [];
    let ts = null;
    if (false) {
      ts = {
        _id: makeId('t_'),
        title,
        term: term || 'Term 1',
        type: 'bulk',
        link: '',
        filePath: `/uploads/${req.file.filename}`,
        classes: cls,
        sections: secs,
        start: start ? new Date(start) : null,
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        description: description || '',
        createdBy: req.user.sub,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      inMemoryTests.push(ts);
    } else {
      ts = await TestSeries.create({
        data: {
          title,
          term: term || 'Term 1',
          type: 'bulk',
          link: '',
          filePath: `/uploads/${req.file.filename}`,
          classes: cls,
          sections: secs,
          start: start ? new Date(start) : null,
          durationMinutes: durationMinutes ? Number(durationMinutes) : null,
          description: description || '',
          createdBy: req.user.sub
        }
      });
    }

    // create Question docs linked to test
    const createdQuestions = [];
    for (const q of questions) {
      // skip invalid/empty questions
      if (!q || !q.questionText || !String(q.questionText).trim()) continue;
      const opts = Array.isArray(q.options) ? q.options.filter(o => !!String(o || '').trim()) : [];
      if (!opts.length) continue;
      try {
        if (false) {
          const qdoc = {
            _id: makeId('q_'),
            testId: (ts.id || ts._id),
            questionText: String(q.questionText).trim(),
            options: opts,
            correctAnswer: q.correctAnswer || '',
            marks: q.marks || 1,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          inMemoryQuestions.push(qdoc);
          createdQuestions.push(qdoc);
        } else {
          const doc = await Question.create({
            data: {
              testId: (ts.id || ts._id),
              questionText: String(q.questionText).trim(),
              options: opts,
              correctAnswer: q.correctAnswer || '',
              marks: q.marks || 1
            }
          });
          createdQuestions.push(doc);
        }
      } catch (e) {
        // skip creation errors for malformed questions
        console.warn('Skipping invalid question during bulk import:', e && e.message);
        continue;
      }
    }
    return res.json({
      test: ts,
      questionsCreated: createdQuestions.length,
      preview: createdQuestions.slice(0, 10)
    });
  } catch (e) {
    return res.status(500).json({
      message: e && e.message ? e.message : String(e)
    });
  }
});

// Parse an uploaded .docx or .pdf and return parsed questions without creating DB records
router.post("/parse", verifyToken, requireRole(['admin', 'faculty']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({
      message: 'file (docx/pdf) required'
    });
    const fp = path.join(uploadsDir, req.file.filename);
    const ext = String(path.extname(fp) || '').toLowerCase();
    let text = '';
    if (ext === '.pdf') {
      if (!pdfParse) return res.status(500).json({
        message: 'Server missing dependency: pdf-parse. Run `npm install pdf-parse` in backend to support PDF parsing.'
      });
      const dataBuffer = fs.readFileSync(fp);
      const pdfRes = await pdfParse(dataBuffer);
      text = pdfRes && pdfRes.text ? String(pdfRes.text) : '';
    } else {
      if (!mammoth) return res.status(500).json({
        message: 'Server missing dependency: mammoth. Run `npm install mammoth` in backend.'
      });
      const data = await mammoth.extractRawText({
        path: fp
      });
      text = data && data.value ? String(data.value) : '';
    }
    if (!text) return res.status(400).json({
      message: 'Empty or unreadable document'
    });

    // build blocks by detecting question-start lines (e.g. "Q1.", "1.")
    const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
    const blocks = [];
    let current = [];
    const questionStartRegex = /^\s*(?:Q\s*\d+\.?|\d+\.)/i;
    for (const line of rawLines) {
      if (questionStartRegex.test(line) && current.length) {
        blocks.push(current.join('\n'));
        current = [line];
      } else {
        current.push(line);
      }
    }
    if (current.length) blocks.push(current.join('\n'));
    const optPrefix = /^[A-Da-d][)\.\-]\s*/;
    const optionLineRegex = /^([A-Da-d]|\d+)\s*[\)\.\-]\s*(.*)$/;
    // allow forms like "Correct Option : C" or "Correct Answer : Washington DC"
    const answerLineRegex = /(answer|ans|correct)(?:\s*\w*)*\s*[:\-]?\s*([A-Za-z0-9 ]+)/i;
    const marksRegex = /(\d+)\s*(marks|mark|mks)/i;
    const questions = [];
    for (const block of blocks) {
      const lines = String(block).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (!lines.length) continue;
      let firstOptIdx = lines.findIndex(l => optionLineRegex.test(l) || optPrefix.test(l));
      if (firstOptIdx === -1) continue;
      const qText = lines.slice(0, firstOptIdx).join(' ');
      const optionLines = [];
      for (let i = firstOptIdx; i < lines.length; i++) {
        const ln = lines[i];
        if (optionLineRegex.test(ln)) {
          const m = ln.match(optionLineRegex);
          optionLines.push(m[2].trim());
        } else if (optPrefix.test(ln)) {
          optionLines.push(ln.replace(optPrefix, '').trim());
        } else {
          if (answerLineRegex.test(ln) || marksRegex.test(ln)) break;
        }
      }
      if (!optionLines.length) continue;

      // find answer (permissive)
      let correct = null;
      const postLines = lines.slice(firstOptIdx + optionLines.length);
      for (const l of postLines) {
        let a = null;
        const am = l.match(answerLineRegex);
        if (am && am[2]) a = String(am[2]).trim();else if (/correct/i.test(l)) {
          const m = l.match(/([A-Da-d]|\d+)\b/g);
          if (m && m.length) a = m[m.length - 1];
        }
        if (a) {
          if (/^[A-Da-d]$/.test(a)) {
            const idx = a.toUpperCase().charCodeAt(0) - 65;
            if (optionLines[idx]) correct = optionLines[idx];
          } else if (/^\d+$/.test(a)) {
            const idx = Number(a) - 1;
            if (optionLines[idx]) correct = optionLines[idx];
          } else {
            const found = optionLines.find(opt => opt.toLowerCase().includes(String(a).toLowerCase()));
            if (found) correct = found;
          }
        }
        if (correct) break;
        if (/\(correct\)|\*correct\*|\*\s*\(|\(ans\)/i.test(l)) {
          for (const opt of optionLines) {
            if (/\(correct\)|\*correct\*|\*\s*$|\(ans\)/i.test(opt)) {
              correct = opt.replace(/\(correct\)|\*correct\*|\*|\(ans\)/ig, '').trim();
              break;
            }
          }
          if (correct) break;
        }
      }

      // fallback: search entire block if answer not found in postLines
      if (!correct) {
        for (const l of lines) {
          let a = null;
          const am = l.match(answerLineRegex);
          if (am && am[2]) a = String(am[2]).trim();else if (/correct/i.test(l)) {
            const m = l.match(/([A-Da-d]|\d+)\b/g);
            if (m && m.length) a = m[m.length - 1];
          }
          if (a) {
            if (/^[A-Da-d]$/.test(a)) {
              const idx = a.toUpperCase().charCodeAt(0) - 65;
              if (optionLines[idx]) {
                correct = optionLines[idx];
                break;
              }
            } else if (/^\d+$/.test(a)) {
              const idx = Number(a) - 1;
              if (optionLines[idx]) {
                correct = optionLines[idx];
                break;
              }
            } else {
              const found = optionLines.find(opt => opt.toLowerCase().includes(String(a).toLowerCase()));
              if (found) {
                correct = found;
                break;
              }
            }
          }
        }
      }
      let marks = 1;
      const mk = block.match(marksRegex);
      if (mk) marks = Number(mk[1]) || 1;
      questions.push({
        questionText: qText,
        options: optionLines,
        correctAnswer: correct,
        marks
      });
    }
    return res.json({
      questions,
      rawText: text
    });
  } catch (e) {
    return res.status(500).json({
      message: e && e.message ? e.message : String(e)
    });
  }
});

// Create multiple questions for an existing test (admin/faculty)
router.post("/:id/questions", verifyToken, requireRole(['admin', 'faculty']), async (req, res) => {
  try {
    const testId = req.params.id;
    const questions = req.body && req.body.questions;
    if (!Array.isArray(questions) || !questions.length) return res.status(400).json({
      message: 'questions array required'
    });
    const created = [];
    if (false) {
      for (const q of questions) {
        if (!q || !q.questionText) continue;
        const opts = Array.isArray(q.options) ? q.options : [];
        const optImgs = Array.isArray(q.optionImages) ? q.optionImages : [];
        const qdoc = {
          _id: makeId('q_'),
          testId: testId,
          questionText: String(q.questionText).trim(),
          questionImage: q.questionImage || '',
          options: opts,
          optionImages: optImgs,
          correctAnswer: q.correctAnswer || '',
          marks: q.marks || 1,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        inMemoryQuestions.push(qdoc);
        created.push(qdoc);
      }
    } else {
      for (const q of questions) {
        if (!q || !q.questionText) continue;
        try {
          // If the client provided an _id, attempt to update the existing question
          if ((q.id || q._id)) {
            const existing = await prisma.question.findUnique({
              where: {
                id: String((q.id || q._id))
              }
            });
            if (existing) {
              // ensure we don't change the test association
              existing.questionText = String(q.questionText).trim();
              existing.questionImage = q.questionImage || '';
              existing.options = Array.isArray(q.options) ? q.options : [];
              existing.optionImages = Array.isArray(q.optionImages) ? q.optionImages : [];
              existing.correctAnswer = q.correctAnswer || '';
              existing.marks = Number(q.marks || 1);
              // Transpiled save()
    if (existing) {
      const { id: _unused_id, _id: _unused__id, save: _unused_save, toObject: _unused_toObject, ..._updateData } = existing;
      
      // Clean out relational arrays if any to prevent Prisma crash
      for (const k in _updateData) {
        if (Array.isArray(_updateData[k]) && _updateData[k].length > 0 && typeof _updateData[k][0] === 'object') {
           delete _updateData[k];
        }
      }

      await prisma.question.update({
        where: { id: String((existing.id || existing._id)) },
        data: _updateData
      }).catch(e => console.error("Transpiled save error:", e.message));
    }
              created.push(existing);
              continue;
            }
            // fallthrough: if _id provided but not found, create new
          }
          const payload = {
            testId: testId,
            questionText: String(q.questionText).trim(),
            questionImage: q.questionImage || '',
            options: Array.isArray(q.options) ? q.options : [],
            optionImages: Array.isArray(q.optionImages) ? q.optionImages : [],
            correctAnswer: q.correctAnswer || '',
            marks: q.marks || 1
          };
          const doc = await prisma.question.create({ data: payload });
          created.push(doc);
        } catch (e) {/* skip invalid entries */}
      }
    }
    return res.json({
      created: created.length,
      preview: created.slice(0, 10)
    });
  } catch (e) {
    return res.status(500).json({
      message: e && e.message ? e.message : String(e)
    });
  }
});

// serve frontend static build if present (optional)

  return router;
};
