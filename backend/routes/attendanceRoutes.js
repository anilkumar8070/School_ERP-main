
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

// CSV export for faculty attendance
router.get("/faculty/export", verifyToken, async (req, res) => {
  try {
    const {
      from,
      to,
      facultyId
    } = req.query || {};
    const filter = {};
    if (from && to) filter.date = {
      $gte: from,
      $lte: to
    };
    const list = await FacultyAttendance.find(filter).lean().catch(() => []);
    const rows = [];
    rows.push(['Date', 'Faculty', 'EmployeeId', 'Status']);
    for (const d of list) {
      const recs = Array.isArray(d.records) ? d.records : [];
      for (const r of recs) {
        if (facultyId && String(r.facultyId) !== String(facultyId)) continue;
        let fac = null;
        try {
          fac = await Faculty.findById(r.facultyId).lean().catch(() => null);
        } catch {}
        rows.push([d.date, fac ? fac.name : String(r.facultyId), fac ? fac.employeeId || '' : '', r.status || '']);
      }
    }
    const csv = rows.map(row => row.map(v => String(v).replace(/"/g, '""')).map(v => /[",\n]/.test(v) ? `"${v}"` : v).join(',')).join('\n');
    const fname = `faculty_attendance_${from || 'start'}_${to || 'end'}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    return res.send(csv);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Student deletion requests (admin): list and approve

// Staff Attendance APIs
router.get("/staff", verifyToken, async (req, res) => {
  try {
    const {
      date,
      from,
      to,
      userId
    } = req.query || {};
    const filter = {};
    if (date) filter.date = date;
    if (from && to) filter.date = {
      $gte: from,
      $lte: to
    };
    const list = await StaffAttendance.find(filter).lean().catch(() => []);
    const narrowed = userId ? list.map(d => ({
      ...d,
      records: Array.isArray(d.records) ? d.records.filter(r => String(r.userId) === String(userId)) : []
    })) : list;
    return res.json(narrowed);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.post("/staff", verifyToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const {
      date,
      records
    } = req.body || {};
    if (!date || !Array.isArray(records) || records.length === 0) return res.status(400).json({
      message: 'date and records required'
    });
    let doc = await StaffAttendance.findOne({
      date
    }).catch(() => null);
    if (!doc) doc = await StaffAttendance.create({
      date,
      records: [],
      createdBy: req.user.sub
    });
    for (const rec of records) {
      const idx = Array.isArray(doc.records) ? doc.records.findIndex(r => String(r.userId) === String(rec.userId)) : -1;
      const payload = {
        userId: rec.userId,
        status: rec.status || 'present',
        markedBy: req.user.sub
      };
      if (idx >= 0) doc.records[idx] = payload;else doc.records.push(payload);
    }
    await doc.save();
    return res.json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// CSV export for staff attendance
router.get("/staff/export", verifyToken, async (req, res) => {
  try {
    const {
      from,
      to,
      userId
    } = req.query || {};
    const filter = {};
    if (from && to) filter.date = {
      $gte: from,
      $lte: to
    };
    const list = await StaffAttendance.find(filter).lean().catch(() => []);
    const rows = [];
    rows.push(['Date', 'Staff', 'StaffId', 'Status']);
    for (const d of list) {
      const recs = Array.isArray(d.records) ? d.records : [];
      for (const r of recs) {
        if (userId && String(r.userId) !== String(userId)) continue;
        let u = null;
        try {
          u = await User.findById(r.userId).lean().catch(() => null);
        } catch {}
        const staffId = u ? `STF-${String(u._id).slice(-6).toUpperCase()}` : '';
        rows.push([d.date, u ? u.name || u.username : String(r.userId), staffId, r.status || '']);
      }
    }
    const csv = rows.map(row => row.map(v => String(v).replace(/"/g, '""')).map(v => /[",\n]/.test(v) ? `"${v}"` : v).join(',')).join('\n');
    const fname = `staff_attendance_${from || 'start'}_${to || 'end'}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    return res.send(csv);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Hostel Allocation APIs
// List allocations (optionally filter by studentId or hostelId)

// Attendance endpoints
router.post("/", verifyToken, requireRole(['faculty', 'admin']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      class: cls,
      section,
      date,
      records
    } = req.body || {};
    if (!cls || !date || !Array.isArray(records)) return res.status(400).json({
      message: 'class, date and records required'
    });
    // prevent future dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const supplied = new Date(date);
    supplied.setHours(0, 0, 0, 0);
    if (supplied > today) return res.status(400).json({
      message: 'Cannot mark attendance for future dates'
    });

    // If the caller is a faculty, ensure they are assigned to this class/section
    if (req.user && req.user.role === 'faculty') {
      const u = await User.findById(req.user.sub).lean().catch(() => null);
      if (!u) return res.status(403).json({
        message: 'Unauthorized'
      });
      let fac = await Faculty.findOne({
        email: u.username
      }).lean().catch(() => null);
      if (!fac && u.name) fac = await Faculty.findOne({
        name: u.name
      }).lean().catch(() => null);
      if (!fac && u.contact) fac = await Faculty.findOne({
        contact: u.contact
      }).lean().catch(() => null);
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
    }
    const q = {
      class: String(cls),
      section: section || '',
      date: String(date)
    };
    // ensure each record has markedBy set to current user
    const enriched = (records || []).map(r => ({
      studentId: r.studentId,
      status: r.status || 'present',
      markedBy: req.user.sub
    }));

    // Validate that supplied student IDs belong to the requested class/section
    try {
      const ids = (enriched || []).map(r => String(r.studentId)).filter(Boolean);
      if (ids.length > 0) {
        const studs = await Student.find({
          _id: {
            $in: ids
          }
        }).lean();
        if (!studs || studs.length !== ids.length) return res.status(400).json({
          message: 'Some student records not found'
        });
        for (const s of studs) {
          if (String(s.class) !== String(cls)) return res.status(400).json({
            message: `Student ${s._id} not in class ${cls}`
          });
          if (section && String(section || '') !== '' && String(s.section || '') !== String(section || '')) return res.status(400).json({
            message: `Student ${s._id} not in section ${section}`
          });
        }
      }
    } catch (valErr) {
      return res.status(400).json({
        message: valErr && valErr.message ? valErr.message : 'Invalid student data'
      });
    }
    // upsert: replace records if exists
    let att = await Attendance.findOne(q);
    // build a map of previous statuses to detect changes for emails
    const previousMap = {};
    if (att && Array.isArray(att.records)) {
      for (const r of att.records) previousMap[String(r.studentId)] = r.status;
    }
    if (att) {
      att.records = enriched;
      att.createdBy = req.user.sub;
      await att.save();
    } else {
      att = await Attendance.create({
        class: String(cls),
        section: section || '',
        date: String(date),
        records: enriched,
        createdBy: req.user.sub
      });
    }

    // Emit SSE so admin/faculty dashboards can refresh in real-time
    try {
      sendSseEvent('attendance_updated', {
        type: 'student',
        class: String(cls),
        section: String(section || ''),
        date: String(date),
        count: enriched.length,
        byRole: req.user && req.user.role
      });
    } catch (e) {}

    // Send email notifications to students for new/changed statuses (best-effort)
    try {
      const changed = [];
      for (const r of enriched) {
        const sid = String(r.studentId);
        const before = previousMap[sid];
        if (!before || before !== r.status) changed.push(r);
      }
      // if new attendance (no previous), send for all
      const toNotify = Object.keys(previousMap).length === 0 ? enriched : changed;
      if (toNotify.length > 0) {
        // fetch students in one query
        const ids = toNotify.map(r => r.studentId);
        const students = await Student.find({
          _id: {
            $in: ids
          }
        }).lean();
        const byId = {};
        students.forEach(s => {
          byId[String(s._id)] = s;
        });
        const titleDate = String(date);
        const classLabel = `Class ${String(cls)}${section ? ' - Section ' + String(section) : ''}`;
        for (const r of toNotify) {
          const s = byId[String(r.studentId)];
          if (!s || !s.email) continue;
          const statusWord = r.status === 'present' ? 'Present' : 'Absent';
          const subject = `Attendance marked for ${titleDate}: ${statusWord}`;
          const html = `
            <div style="font-family:Inter,Arial,sans-serif;background:#f6f7fb;padding:20px;color:#111">
              <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:10px;overflow:hidden">
                <div style="background:linear-gradient(90deg,#06b6d4,#7c3aed);color:#fff;padding:16px 20px">
                  <h2 style="margin:0;font-size:18px">Attendance Update — ${titleDate}</h2>
                </div>
                <div style="padding:16px 20px;line-height:1.6">
                  <p style="margin:0 0 8px">Hello ${s.name || 'Student'},</p>
                  <p style="margin:0 0 8px">Your attendance has been marked as <strong>${statusWord}</strong> for ${classLabel} on <strong>${titleDate}</strong>.</p>
                  <p style="margin:8px 0 0;color:#6b7280;font-size:13px">This is an automated notification from the ERP system.</p>
                </div>
              </div>
            </div>
          `;
          // fire and forget
          notifyEvent({
            event: 'attendance_marked',
            phone: s.contact,
            message: `Attendance update: ${statusWord} on ${titleDate} for ${classLabel}`,
            emailOpts: {
              to: s.email,
              subject,
              html
            }
          }).catch(() => {});
        }
      }
    } catch (mailErr) {
      console.warn('Attendance email notify failed:', mailErr && (mailErr.message || String(mailErr)));
    }
    return res.status(201).json(att);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.get("/", verifyToken, requireRole(['admin', 'faculty', 'student', 'parent']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      class: cls,
      section,
      date
    } = req.query || {};
    const q = {};
    if (cls) q.class = String(cls);
    if (section) q.section = String(section);
    if (date) q.date = String(date);
    const items = await Attendance.find(q).sort({
      date: -1
    }).lean();
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Export student attendance history as CSV
router.get("/export", verifyToken, requireRole(['admin', 'faculty', 'student', 'parent']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      class: cls,
      section,
      studentId: rawStudentId,
      from,
      to
    } = req.query || {};
    const role = req.user && req.user.role;
    let effectiveStudentId = rawStudentId || null;
    // Restrict access per role
    if (role === 'student') {
      const me = await Student.findOne({
        email: req.user.username
      }).lean().catch(() => null);
      if (!me) return res.status(404).json({
        message: 'Student record not found'
      });
      effectiveStudentId = String(me._id);
    } else if (role === 'parent') {
      if (!rawStudentId) return res.status(400).json({
        message: 'studentId required for parent'
      });
      const user = await User.findById(req.user.sub).lean().catch(() => null);
      if (!user || user.role !== 'parent') return res.status(403).json({
        message: 'Unauthorized'
      });
      const allowed = Array.isArray(user.parentOf) && user.parentOf.some(x => String(x) === String(rawStudentId));
      if (!allowed) return res.status(403).json({
        message: 'Not linked to this student'
      });
      effectiveStudentId = String(rawStudentId);
    }
    const q = {};
    if (cls) q.class = String(cls);
    if (section) q.section = String(section);
    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = String(from);
      if (to) q.date.$lte = String(to);
    }
    const items = await Attendance.find(q).sort({
      date: 1
    }).lean();
    // collect student ids present
    const ids = new Set();
    (items || []).forEach(it => {
      ;
      (it.records || []).forEach(r => {
        if (!effectiveStudentId || String(r.studentId) === String(effectiveStudentId)) ids.add(String(r.studentId));
      });
    });
    // fetch student details for nice CSV
    const byId = {};
    if (ids.size > 0) {
      const docs = await Student.find({
        _id: {
          $in: Array.from(ids)
        }
      }).lean();
      (docs || []).forEach(s => {
        byId[String(s._id)] = s;
      });
    }
    const rows = [['Date', 'Class', 'Section', 'StudentId', 'StudentName', 'Roll', 'Status']];
    (items || []).forEach(it => {
      ;
      (it.records || []).forEach(r => {
        if (effectiveStudentId && String(r.studentId) !== String(effectiveStudentId)) return;
        const s = byId[String(r.studentId)];
        rows.push([String(it.date || ''), String(it.class || ''), String(it.section || ''), String(r.studentId || ''), s && s.name ? String(s.name) : '', s && s.rollNo ? String(s.rollNo) : '', String(r.status || '')]);
      });
    });
    const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const fnameParts = ['attendance_students'];
    if (cls) fnameParts.push(`class-${String(cls)}`);
    if (section) fnameParts.push(`section-${String(section)}`);
    if (effectiveStudentId) fnameParts.push(`student-${String(effectiveStudentId).slice(-6)}`);
    if (from) fnameParts.push(`from-${String(from)}`);
    if (to) fnameParts.push(`to-${String(to)}`);
    const filename = fnameParts.join('_') + '.csv';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Faculty attendance endpoints
router.post("/faculty", verifyToken, requireRole(['faculty', 'admin']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      date,
      records
    } = req.body || {};
    if (!date || !Array.isArray(records)) return res.status(400).json({
      message: 'date and records required'
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const supplied = new Date(date);
    supplied.setHours(0, 0, 0, 0);
    if (supplied > today) return res.status(400).json({
      message: 'Cannot mark attendance for future dates'
    });
    let att = await FacultyAttendance.findOne({
      date: String(date)
    });
    const enriched = (records || []).map(r => ({
      facultyId: r.facultyId,
      status: r.status || 'present',
      markedBy: req.user.sub
    }));
    if (att) {
      att.records = enriched;
      att.createdBy = req.user.sub;
      await att.save();
    } else {
      att = await FacultyAttendance.create({
        date: String(date),
        records: enriched,
        createdBy: req.user.sub
      });
    }
    // SSE notify for faculty attendance updates
    try {
      sendSseEvent('attendance_updated', {
        type: 'faculty',
        date: String(date),
        count: enriched.length,
        byRole: req.user && req.user.role
      });
    } catch (e) {}
    return res.status(201).json(att);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.get("/faculty", verifyToken, requireRole(['admin', 'faculty']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      date
    } = req.query || {};
    const q = {};
    if (date) q.date = String(date);
    const items = await FacultyAttendance.find(q).sort({
      date: -1
    }).lean();
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Export faculty attendance history as CSV
router.get("/faculty/export", verifyToken, requireRole(['admin', 'faculty']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      facultyId,
      from,
      to
    } = req.query || {};
    const q = {};
    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = String(from);
      if (to) q.date.$lte = String(to);
    }
    const items = await FacultyAttendance.find(q).sort({
      date: 1
    }).lean();
    const ids = new Set();
    (items || []).forEach(it => {
      ;
      (it.records || []).forEach(r => {
        if (!facultyId || String(r.facultyId) === String(facultyId)) ids.add(String(r.facultyId));
      });
    });
    const fById = {};
    if (ids.size > 0) {
      const docs = await Faculty.find({
        _id: {
          $in: Array.from(ids)
        }
      }).lean();
      (docs || []).forEach(f => {
        fById[String(f._id)] = f;
      });
    }
    const rows = [['Date', 'FacultyId', 'Name', 'EmployeeId', 'Subject', 'Status']];
    (items || []).forEach(it => {
      ;
      (it.records || []).forEach(r => {
        if (facultyId && String(r.facultyId) !== String(facultyId)) return;
        const f = fById[String(r.facultyId)];
        rows.push([String(it.date || ''), String(r.facultyId || ''), f && f.name ? String(f.name) : '', f && f.employeeId ? String(f.employeeId) : '', f && f.subject ? String(f.subject) : '', String(r.status || '')]);
      });
    });
    const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const fnameParts = ['attendance_faculty'];
    if (facultyId) fnameParts.push(`faculty-${String(facultyId).slice(-6)}`);
    if (from) fnameParts.push(`from-${String(from)}`);
    if (to) fnameParts.push(`to-${String(to)}`);
    const filename = fnameParts.join('_') + '.csv';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Marks endpoints (basic create/update/list)

// Legacy-compatible faculty attendance endpoints used by existing frontend

// ===================== Excel Export APIs =====================
router.get("/faculty", verifyToken, async (req, res) => {
  try {
    const {
      date,
      from,
      to,
      facultyId
    } = req.query || {};
    const filter = {};
    if (date) filter.date = date;
    if (from && to) filter.date = {
      $gte: from,
      $lte: to
    };
    const list = await FacultyAttendance.find(filter).lean().catch(() => []);
    // Narrow per faculty if requested
    const narrowed = facultyId ? list.map(d => ({
      ...d,
      records: Array.isArray(d.records) ? d.records.filter(r => String(r.facultyId) === String(facultyId)) : []
    })) : list;
    return res.json(narrowed);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.post("/faculty", verifyToken, requireRole('admin|faculty'), async (req, res) => {
  try {
    const {
      date,
      records
    } = req.body || {};
    if (!date || !Array.isArray(records) || records.length === 0) return res.status(400).json({
      message: 'date and records required'
    });
    // Try to resolve current user's mapped Faculty record for self-marking
    let currentFaculty = null;
    try {
      const meUser = await User.findById(req.user.sub).lean().catch(() => null);
      if (meUser && meUser.username) {
        currentFaculty = await Faculty.findOne({
          email: meUser.username
        }).lean().catch(() => null);
      }
    } catch {}
    let doc = await FacultyAttendance.findOne({
      date
    }).catch(() => null);
    if (!doc) doc = await FacultyAttendance.create({
      date,
      records: [],
      createdBy: req.user.sub
    });
    for (const rec of records) {
      // Determine faculty id: prefer provided rec.facultyId; if missing or not found, fall back to current user's mapped faculty
      let fid = rec && rec.facultyId ? rec.facultyId : currentFaculty && currentFaculty._id;
      // If fid is still not resolved, attempt lookup by employeeId
      if (!fid && rec && rec.employeeId) {
        const byEmp = await Faculty.findOne({
          employeeId: rec.employeeId
        }).lean().catch(() => null);
        if (byEmp) fid = byEmp._id;
      }
      if (!fid) continue; // skip if we cannot resolve a faculty id
      const idx = Array.isArray(doc.records) ? doc.records.findIndex(r => String(r.facultyId) === String(fid)) : -1;
      const payload = {
        facultyId: fid,
        status: rec.status || 'present',
        markedBy: req.user.sub
      };
      if (idx >= 0) doc.records[idx] = payload;else doc.records.push(payload);
    }
    await doc.save();
    // Notify UIs to refresh this date (admin/faculty pages)
    try {
      sendSseEvent('attendance_updated', {
        type: 'faculty',
        date
      });
    } catch (e) {}
    return res.json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.get("/faculty/export", verifyToken, async (req, res) => {
  try {
    const {
      from,
      to,
      facultyId
    } = req.query || {};
    const filter = {};
    if (from && to) filter.date = {
      $gte: from,
      $lte: to
    };
    const list = await FacultyAttendance.find(filter).lean().catch(() => []);
    const rows = [];
    rows.push(['Date', 'Faculty', 'EmployeeId', 'Status']);
    for (const d of list) {
      const recs = Array.isArray(d.records) ? d.records : [];
      for (const r of recs) {
        if (facultyId && String(r.facultyId) !== String(facultyId)) continue;
        let fac = null;
        try {
          fac = await Faculty.findById(r.facultyId).lean().catch(() => null);
        } catch {}
        rows.push([d.date, fac ? fac.name : String(r.facultyId), fac ? fac.employeeId || '' : '', r.status || '']);
      }
    }
    const csv = rows.map(row => row.map(v => String(v).replace(/"/g, '""')).map(v => /[",\n]/.test(v) ? `"${v}"` : v).join(',')).join('\n');
    const fname = `faculty_attendance_${from || 'start'}_${to || 'end'}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    return res.send(csv);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

  return router;
};
