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

// protected profile
router.get("/", verifyToken, async (req, res) => {
  try {
    // try to return a DB-backed user profile when possible
    const uid = req.user && req.user.sub;
    if (!uid) return res.json({
      user: req.user
    });
    const user = await prisma.user.findUnique({
      where: {
        id: String(uid)
      }
    }).catch(() => null);
    if (!user) return res.json({
      user: req.user
    });

    // try to attach student/faculty records when available
    let student = null;
    let faculty = null;
    try {
      student = await prisma.student.findUnique({
        where: {
          id: String(uid)
        }
      }).catch(() => null);
    } catch (e) {
      student = null;
    }
    try {
      faculty = await prisma.faculty.findFirst({
        where: {
          email: user.username
        }
      }).catch(() => null);
      if (!faculty && user.name) faculty = await prisma.faculty.findFirst({
        where: {
          name: user.name
        }
      }).catch(() => null);
      if (!faculty && user.contact) faculty = await prisma.faculty.findFirst({
        where: {
          contact: user.contact
        }
      }).catch(() => null);
    } catch (e) {
      faculty = null;
    }
    return res.json({
      user,
      student,
      faculty
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Update profile: updates User fields and tries to sync Student/Faculty when possible
router.put("/", verifyToken, async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const uid = req.user && req.user.sub;
    if (!uid) return res.status(400).json({
      message: 'User id missing'
    });
    const payload = req.body || {};
    // Only allow a subset of fields
    const allowed = ['name', 'contact', 'address', 'avatar', 'email'];
    const up = {};
    for (const k of allowed) if (payload[k] !== undefined) up[k] = payload[k];
    const updatedUser = await prisma.user.update({
      where: {
        id: String(uid)
      },

      data: up
    }).catch(() => null);

    // try to update student/faculty records if present
    let updatedStudent = null;
    let updatedFaculty = null;
    try {
      let s = await prisma.student.findUnique({
        where: {
          id: String(uid)
        }
      }).catch(() => null);
      if (s) {
        const su = {};
        if (up.name) su.name = up.name;
        if (up.contact) su.contact = up.contact;
        if (up.address) su.address = up.address;
        if (Object.keys(su).length > 0) {
          s.set(su);
          // Transpiled save()
    if (s) {
      const { id: _unused_id, _id: _unused__id, save: _unused_save, toObject: _unused_toObject, ..._updateData } = s;
      
      // Clean out relational arrays if any to prevent Prisma crash
      for (const k in _updateData) {
        if (Array.isArray(_updateData[k]) && _updateData[k].length > 0 && typeof _updateData[k][0] === 'object') {
           delete _updateData[k];
        }
      }

      await prisma.student.update({
        where: { id: String((s.id || s._id)) },
        data: _updateData
      }).catch(e => console.error("Transpiled save error:", e.message));
    }
          updatedStudent = s;
        }
      }
    } catch (e) {/* ignore */}
    try {
      let f = await prisma.faculty.findFirst({
        where: {
          email: updatedUser && updatedUser.username
        }
      }).catch(() => null);
      if (!f && updatedUser && updatedUser.name) f = await prisma.faculty.findFirst({
        where: {
          name: updatedUser.name
        }
      }).catch(() => null);
      if (f) {
        const fu = {};
        if (up.name) fu.name = up.name;
        if (up.contact) fu.contact = up.contact;
        if (up.address) fu.address = up.address;
        if (Object.keys(fu).length > 0) {
          f.set(fu);
          // Transpiled save()
    if (f) {
      const { id: _unused_id, _id: _unused__id, save: _unused_save, toObject: _unused_toObject, ..._updateData } = f;
      
      // Clean out relational arrays if any to prevent Prisma crash
      for (const k in _updateData) {
        if (Array.isArray(_updateData[k]) && _updateData[k].length > 0 && typeof _updateData[k][0] === 'object') {
           delete _updateData[k];
        }
      }

      await prisma.faculty.update({
        where: { id: String((f.id || f._id)) },
        data: _updateData
      }).catch(e => console.error("Transpiled save error:", e.message));
    }
          updatedFaculty = f;
        }
      }
    } catch (e) {/* ignore */}
    return res.json({
      user: updatedUser,
      student: updatedStudent,
      faculty: updatedFaculty
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Student dashboard stats overview
router.get("/dashboard-stats", verifyToken, requireRole('student'), async (req, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: { OR: [ { id: String(req.user.sub) }, { email: req.user.username } ] }
    });
    
    if (!student) {
      return res.json({ attendance: '0%', assignments: '00', tests: '00', schedule: '00', notices: '00' });
    }

    const cls = student.class || '';
    const sec = student.section || '';

    // Attendance
    let attendance = '0%';
    try {
      const atts = await prisma.attendance.findMany({ where: { class: cls } });
      let totalDays = 0;
      let presentDays = 0;
      atts.forEach(a => {
        if (a.section && a.section !== sec) return; // skip other sections if specified
        totalDays++;
        let records = a.records;
        if (typeof records === 'string') { try { records = JSON.parse(records); } catch(e){} }
        if (Array.isArray(records)) {
          const rec = records.find(r => String(r.studentId) === String(student.id) || String(r.rollNo) === String(student.rollNo));
          if (rec && rec.status === 'present') presentDays++;
        }
      });
      if (totalDays > 0) attendance = Math.round((presentDays / totalDays) * 100) + '%';
      else attendance = '100%';
    } catch(e) {}

    // Assignments
    let assignments = '00';
    try {
      const totalAssigns = await prisma.assignment.count({ where: { class: cls } });
      assignments = totalAssigns < 10 ? '0' + totalAssigns : String(totalAssigns);
    } catch(e) {}

    // Tests
    let tests = '00';
    try {
      const allTests = await prisma.testSeries.findMany();
      const relevant = allTests.filter(t => {
         let cs = t.classes;
         if (typeof cs === 'string') { try { cs = JSON.parse(cs) } catch(e){} }
         if (Array.isArray(cs) && cs.length > 0) return cs.includes(cls);
         return true;
      });
      tests = relevant.length < 10 ? '0' + relevant.length : String(relevant.length);
    } catch(e) {}

    // Schedule (Timetables)
    let schedule = '00';
    try {
      const tt = await prisma.timetable.count({ where: { class: cls } });
      schedule = tt < 10 ? '0' + tt : String(tt);
    } catch(e) {}

    // Notices
    let notices = '00';
    try {
      const nts = await prisma.notice.findMany();
      const relevantN = nts.filter(n => {
         let targets = n.targetClasses;
         if (typeof targets === 'string') { try { targets = JSON.parse(targets) } catch(e){} }
         if (Array.isArray(targets) && targets.length > 0) return targets.includes(cls);
         return true;
      });
      notices = relevantN.length < 10 ? '0' + relevantN.length : String(relevantN.length);
    } catch(e) {}

    res.json({ attendance, assignments, tests, schedule, notices });
  } catch(e) {
    res.status(500).json({ message: e.message });
  }
});

// Password reset: request reset (creates token, emails user)

  return router;
};
