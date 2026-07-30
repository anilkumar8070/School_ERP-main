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

// Receipts: list my receipts
router.get("/my", verifyToken, async (req, res) => {
  try {
    const userId = req.user && req.user.sub;
    if (!userId) return res.status(401).json({
      message: 'Not authenticated'
    });
    const list = await prisma.receipt.findMany({
      where: {
        studentId: userId
      },

      orderBy: {
        createdAt: "desc"
      }
    }).catch(() => []);
    return res.json(list);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Hostel receipts: list my hostel receipts (separate from generic receipts list)

  return router;
};
