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

// Marks endpoints (basic create/update/list)
router.post("/", verifyToken, requireRole('faculty'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      class: cls,
      section,
      studentId,
      subject,
      total,
      obtained,
      term
    } = req.body || {};
    if (!cls || !studentId || subject === undefined || obtained === undefined) return res.status(400).json({
      message: 'class, studentId, subject, obtained required'
    });
    // Ensure faculty is assigned to this class/section and student belongs to it
    if (req.user && req.user.role === 'faculty') {
      const u = await prisma.user.findUnique({
        where: {
          id: String(req.user.sub)
        }
      }).catch(() => null);
      if (!u) return res.status(403).json({
        message: 'Unauthorized'
      });
      let fac = await prisma.faculty.findFirst({
        where: {
          email: u.username
        }
      }).catch(() => null);
      if (!fac && u.name) fac = await prisma.faculty.findFirst({
        where: {
          name: u.name
        }
      }).catch(() => null);
      if (!fac && u.contact) fac = await prisma.faculty.findFirst({
        where: {
          contact: u.contact
        }
      }).catch(() => null);
      if (!fac) return res.status(403).json({
        message: 'Faculty record not linked'
      });
      const clsStr = String(cls);
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
      // validate student belongs to class/section
      const sdoc = await prisma.student.findUnique({
        where: {
          id: String(studentId)
        }
      }).catch(() => null);
      if (!sdoc) return res.status(400).json({
        message: 'Student not found'
      });
      if (String(sdoc.class) !== clsStr) return res.status(400).json({
        message: `Student ${studentId} not in class ${cls}`
      });
      if (section && String(sdoc.section || '') !== secStr) return res.status(400).json({
        message: `Student ${studentId} not in section ${section}`
      });
    }
    // Prevent duplicate: if a mark exists for student+subject+term, update it instead
    const existing = await prisma.mark.findFirst({
      where: {
        studentId,
        subject,
        term: term || ''
      }
    });
    if (existing) {
      existing.obtained = Number(obtained);
      if (total !== undefined) existing.total = Number(total);
      existing.class = String(cls);
      existing.section = section || '';
      existing.createdBy = req.user.sub;
      // Transpiled save()
    if (existing) {
      const { id: _unused_id, _id: _unused__id, save: _unused_save, toObject: _unused_toObject, ..._updateData } = existing;
      
      // Clean out relational arrays if any to prevent Prisma crash
      for (const k in _updateData) {
        if (Array.isArray(_updateData[k]) && _updateData[k].length > 0 && typeof _updateData[k][0] === 'object') {
           delete _updateData[k];
        }
      }

      await prisma.mark.update({
        where: { id: String((existing.id || existing._id)) },
        data: _updateData
      }).catch(e => console.error("Transpiled save error:", e.message));
    }
      return res.json(existing);
    }
    const m = await Mark.create({
      data: {
        class: String(cls),
        section: section || '',
        studentId,
        subject,
        total: Number(total || 0),
        obtained: Number(obtained),
        term: term || '',
        createdBy: req.user.sub
      }
    });
    return res.status(201).json(m);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Bulk upsert marks: accepts array of marks
router.post("/bulk", verifyToken, requireRole('faculty'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const items = Array.isArray(req.body) ? req.body : req.body && req.body.marks || [];
    if (!items.length) return res.status(400).json({
      message: 'marks array required'
    });
    const results = [];
    for (const it of items) {
      const {
        class: cls,
        section,
        studentId,
        subject,
        total,
        obtained,
        term
      } = it || {};
      if (!studentId || subject === undefined || obtained === undefined) continue;
      const key = {
        studentId,
        subject,
        term: term || ''
      };
      let existing = await prisma.mark.findFirst({
        where: key
      });
      if (existing) {
        existing.obtained = Number(obtained);
        if (total !== undefined) existing.total = Number(total);
        existing.class = String(cls || existing.class);
        existing.section = section || existing.section;
        existing.createdBy = req.user.sub;
        // Transpiled save()
    if (existing) {
      const { id: _unused_id, _id: _unused__id, save: _unused_save, toObject: _unused_toObject, ..._updateData } = existing;
      
      // Clean out relational arrays if any to prevent Prisma crash
      for (const k in _updateData) {
        if (Array.isArray(_updateData[k]) && _updateData[k].length > 0 && typeof _updateData[k][0] === 'object') {
           delete _updateData[k];
        }
      }

      await prisma.mark.update({
        where: { id: String((existing.id || existing._id)) },
        data: _updateData
      }).catch(e => console.error("Transpiled save error:", e.message));
    }
        results.push(existing);
      } else {
        const created = await Mark.create({
          data: {
            class: String(cls || ''),
            section: section || '',
            studentId,
            subject,
            total: Number(total || 0),
            obtained: Number(obtained),
            term: term || '',
            createdBy: req.user.sub
          }
        });
        results.push(created);
      }
    }
    return res.json(results);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.put("/:id", verifyToken, requireRole('faculty'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const upd = await prisma.mark.findUnique({
      where: {
        id: String(req.params.id)
      }
    });
    if (!upd) return res.status(404).json({
      message: 'Not found'
    });
    const {
      obtained,
      total,
      subject,
      term
    } = req.body || {};
    if (obtained !== undefined) upd.obtained = Number(obtained);
    if (total !== undefined) upd.total = Number(total);
    if (subject !== undefined) upd.subject = subject;
    if (term !== undefined) upd.term = term;
    // Transpiled save()
    if (upd) {
      const { id: _unused_id, _id: _unused__id, save: _unused_save, toObject: _unused_toObject, ..._updateData } = upd;
      
      // Clean out relational arrays if any to prevent Prisma crash
      for (const k in _updateData) {
        if (Array.isArray(_updateData[k]) && _updateData[k].length > 0 && typeof _updateData[k][0] === 'object') {
           delete _updateData[k];
        }
      }

      await prisma.mark.update({
        where: { id: String((upd.id || upd._id)) },
        data: _updateData
      }).catch(e => console.error("Transpiled save error:", e.message));
    }
    return res.json(upd);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.get("/", verifyToken, requireRole(['admin', 'faculty', 'parent', 'student']), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      class: cls,
      section,
      studentId
    } = req.query || {};
    const q = {};
    if (cls) q.class = String(cls);
    if (section) q.section = String(section);
    if (studentId) q.studentId = studentId;
    const items = await prisma.mark.findMany({
      where: q,

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

// Return marks for the logged-in student (or parent with studentId query)
router.get("/my", verifyToken, requireRole(['student', 'parent', 'faculty', 'admin']), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const role = req.user && req.user.role;
    if (role === 'student') {
      // find student by email = username
      const s = await prisma.student.findFirst({
        where: {
          email: req.user.username
        }
      });
      if (!s) return res.status(404).json({
        message: 'Student record not found'
      });
      const items = await prisma.mark.findMany({
        where: {
          studentId: (s.id || s._id)
        },

        orderBy: {
          createdAt: "desc"
        }
      });
      return res.json(items);
    }
    // parent: require studentId query param
    if (role === 'parent') {
      const {
        studentId
      } = req.query || {};
      if (!studentId) return res.status(400).json({
        message: 'studentId required for parent'
      });
      const items = await prisma.mark.findMany({
        where: {
          studentId
        },

        orderBy: {
          createdAt: "desc"
        }
      });
      return res.json(items);
    }
    // faculty/admin: support optional studentId query
    const {
      studentId
    } = req.query || {};
    const q = {};
    if (studentId) q.studentId = studentId;
    const items = await prisma.mark.findMany({
      where: q,

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

// Faculty: lesson planning management

  return router;
};
