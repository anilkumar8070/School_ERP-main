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

router.get("/excel", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const type = String(req.query && req.query.type || 'attendance');
    const reportBuilders = {
      attendance: {
        title: 'Attendance Report',
        file: 'attendance_report.xls',
        build: buildAttendanceReportRows
      },
      fees: {
        title: 'Fees Report',
        file: 'fees_report.xls',
        build: buildFeesReportRows
      },
      marks: {
        title: 'Marks Report',
        file: 'marks_report.xls',
        build: buildMarksReportRows
      }
    };
    if (type === 'custom') {
      const attendanceRows = await buildAttendanceReportRows(req.query);
      const feesRows = await buildFeesReportRows(req.query);
      const marksRows = await buildMarksReportRows(req.query);
      return sendExcelSheets(res, [{
        name: 'Attendance',
        title: 'Attendance Report',
        rows: attendanceRows
      }, {
        name: 'Fees',
        title: 'Fees Report',
        rows: feesRows
      }, {
        name: 'Marks',
        title: 'Marks Report',
        rows: marksRows
      }], 'combined_school_report.xls');
    }
    const selected = reportBuilders[type];
    if (!selected) return res.status(400).json({
      message: 'Invalid report type'
    });
    const rows = await selected.build(req.query);
    return sendExcel(res, selected.title, rows, selected.file);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: approve student registration

  return router;
};
