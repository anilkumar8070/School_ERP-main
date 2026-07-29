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

// Meetings
// Admin can create meetings targeted to students (all / class / section / specific student)
router.post("/", verifyToken, requireRole(['admin', 'faculty']), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      title,
      summary,
      datetime,
      link,
      audience = 'students',
      class: cls,
      section,
      studentId
    } = req.body || {};
    if (!title || !datetime) return res.status(400).json({
      message: 'title and datetime required'
    });
    // If a faculty is creating a meeting targeted to students, ensure they are assigned to that class/section
    if (req.user && req.user.role === 'faculty' && (audience === 'student' || audience === 'students')) {
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
      const clsStr = String(cls || '');
      const secStr = String(section || '');
      let allowed = false;
      for (const a of fac.assignments || []) {
        if (String(a.class) !== clsStr) continue;
        if (a.isClassTeacher) {
          allowed = true;
          break;
        }
        if (a.section && String(a.section) === secStr) {
          allowed = true;
          break;
        }
      }
      if (!allowed) return res.status(403).json({
        message: 'Not assigned to this class/section'
      });
    }
    const m = await Meeting.create({
      title,
      summary,
      datetime: new Date(datetime),
      link,
      audience,
      class: cls,
      section,
      studentId,
      createdBy: req.user.sub
    });
    // notify SSE clients
    try {
      sendSseEvent('meeting_created', {
        id: m._id,
        title: m.title
      });
    } catch (e) {}
    return res.status(201).json(m);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: list meetings
router.get("/", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    // populate createdBy name so admin sees who created the meeting
    const items = await prisma.meeting.findMany().sort({
      datetime: -1
    }).populate('createdBy', 'name');
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// My meetings - for students (and generic for other roles)
router.get("/my", verifyToken, async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const role = req.user.role || 'student';
    if (role === 'student') {
      // find student's record by email (username)
      const userEmail = req.user.username;
      const studentDoc = await Student.findOne({
        email: userEmail
      });
      const now = new Date();
      const q = {
        datetime: {
          $gte: now
        }
      };
      // match audience: all OR student(s) (either singular/plural) OR targeted to this class/section OR specific studentId
      const or = [{
        audience: 'all'
      }, {
        audience: 'students',
        class: {
          $exists: false
        }
      }, {
        audience: 'student',
        class: {
          $exists: false
        }
      }, {
        audience: 'students'
      }, {
        audience: 'student'
      }];
      // build more specific matches
      const specific = [];
      if (studentDoc) {
        specific.push({
          audience: 'students',
          class: studentDoc.class
        });
        specific.push({
          audience: 'student',
          class: studentDoc.class
        });
        if (studentDoc.section) {
          specific.push({
            audience: 'students',
            class: studentDoc.class,
            section: studentDoc.section
          });
          specific.push({
            audience: 'student',
            class: studentDoc.class,
            section: studentDoc.section
          });
        }
        specific.push({
          audience: 'student',
          studentId: studentDoc._id
        });
      }
      const finalOr = or.concat(specific);
      // deduplicate simple: use $or with constructed array
      q.$or = finalOr;
      const items = await prisma.meeting.findMany({ where: q }).sort({
        datetime: 1
      });
      return res.json(items);
    }
    // non-students: faculty should also see meetings targeted to students in their assigned classes
    if (role === 'faculty') {
      // resolve faculty record
      const u = await prisma.user.findUnique({ where: { id: String(req.user.sub) } }).catch(() => null);
      let fac = null;
      if (u) {
        fac = await Faculty.findOne({
          email: u.username
        }).catch(() => null);
        if (!fac && u.name) fac = await Faculty.findOne({
          name: u.name
        }).catch(() => null);
        if (!fac && u.contact) fac = await Faculty.findOne({
          contact: u.contact
        }).catch(() => null);
      }
      // base items: audience all, audience faculty, audience role plural, and createdBy
      const rolePlural = `${req.user.role}s`;
      const baseQ = {
        $or: [{
          audience: 'all'
        }, {
          audience: req.user.role
        }, {
          audience: rolePlural
        }, {
          createdBy: req.user.sub
        }]
      };
      let items = await prisma.meeting.findMany({ where: baseQ }).sort({
        datetime: 1
      });
      // include meetings targeted to students for classes/sections the faculty is assigned to
      if (fac && Array.isArray(fac.assignments) && fac.assignments.length > 0) {
        const orClauses = [];
        for (const a of fac.assignments || []) {
          if (!a.class) continue;
          orClauses.push({
            audience: 'students',
            class: String(a.class)
          });
          orClauses.push({
            audience: 'student',
            class: String(a.class)
          });
          if (a.section) {
            orClauses.push({
              audience: 'students',
              class: String(a.class),
              section: String(a.section)
            });
            orClauses.push({
              audience: 'student',
              class: String(a.class),
              section: String(a.section)
            });
          }
        }
        if (orClauses.length > 0) {
          const studentMeetings = await Meeting.find({
            $or: orClauses
          }).sort({
            datetime: 1
          });
          items = items.concat(studentMeetings);
          // deduplicate by _id
          const seen = new Set();
          items = items.filter(it => {
            if (!it || !it._id) return false;
            const id = String(it._id);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
        }
      }
      return res.json(items);
    }
    // other roles: return meetings addressed to all or role and those created by the user
    const rolePlural = `${req.user.role}s`;
    const items = await Meeting.find({
      $or: [{
        audience: 'all'
      }, {
        audience: req.user.role
      }, {
        audience: rolePlural
      }, {
        createdBy: req.user.sub
      }]
    }).sort({
      datetime: 1
    });
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Students - list/filter (admin or faculty)

  return router;
};
