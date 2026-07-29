
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

// Student/Parent/Admin: rank summary for one student within class-section
router.get("/rank/:id", verifyToken, requireRole(['student', 'parent', 'admin', 'faculty']), async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({
      message: 'student id required'
    });
    const student = await Student.findById(id).lean().catch(() => null);
    if (!student) return res.status(404).json({
      message: 'Student not found'
    });
    if (req.user.role === 'parent') {
      const parent = await User.findById(req.user.sub).lean().catch(() => null);
      const linked = parent && Array.isArray(parent.parentOf) && parent.parentOf.some(x => String(x) === String(id));
      if (!linked) return res.status(403).json({
        message: 'Parent is not linked to this student'
      });
    }
    if (req.user.role === 'student' && String(req.user.username || '').toLowerCase() !== String(student.email || '').toLowerCase()) {
      return res.status(403).json({
        message: 'Forbidden'
      });
    }
    const students = await Student.find({
      class: student.class,
      section: student.section
    }).lean().catch(() => []);
    const rows = [];
    for (const s of students) {
      const tests = await TestResult.find({
        $or: [{
          studentId: s._id
        }, {
          email: s.email
        }]
      }).lean().catch(() => []);
      const cards = await ReportCard.find({
        $or: [{
          recipientEmail: s.email
        }, {
          recipientId: s._id
        }, {
          rollNumber: s.rollNo,
          className: s.class,
          section: s.section
        }]
      }).lean().catch(() => []);
      const reportPercentages = cards.map(c => Number(c.percentage)).filter(n => Number.isFinite(n) && n > 0);
      const testPercentages = tests.map(t => {
        if (Number.isFinite(Number(t.percentage))) return Number(t.percentage);
        if (Number(t.total) > 0) return Number(t.score || 0) / Number(t.total) * 100;
        return null;
      }).filter(n => Number.isFinite(n));
      const scores = reportPercentages.length ? reportPercentages : testPercentages;
      const avg = scores.length ? scores.reduce((sum, n) => sum + n, 0) / scores.length : null;
      rows.push({
        studentId: String(s._id),
        name: s.name,
        rollNo: s.rollNo,
        avg: avg == null ? null : Number(avg.toFixed(2)),
        count: scores.length
      });
    }
    rows.sort((a, b) => {
      const aa = typeof a.avg === 'number' ? a.avg : -Infinity;
      const bb = typeof b.avg === 'number' ? b.avg : -Infinity;
      if (aa !== bb) return bb - aa;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    const index = rows.findIndex(r => String(r.studentId) === String(id));
    const row = index >= 0 ? rows[index] : null;
    return res.json({
      rank: index >= 0 ? index + 1 : null,
      totalStudents: rows.length,
      class: student.class,
      section: student.section,
      average: row ? row.avg : null,
      recordsCount: row ? row.count : 0
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Download report card file

  return router;
};
