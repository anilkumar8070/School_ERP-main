
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

router.get("/", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const settings = await NotificationSettings.find().lean();
    res.json(settings);
  } catch (e) {
    res.status(500).json({
      message: e.message
    });
  }
});
router.patch("/", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const items = req.body; // array of { event, email, sms, whatsapp }
    for (const item of items) {
      await NotificationSettings.findOneAndUpdate({
        event: item.event
      }, {
        email: item.email,
        sms: item.sms,
        whatsapp: item.whatsapp
      }, {
        upsert: true,
        new: true
      });
    }
    res.json({
      success: true
    });
  } catch (e) {
    res.status(500).json({
      message: e.message
    });
  }
});

// Global error handling middleware (must be registered after all routes)

  return router;
};
