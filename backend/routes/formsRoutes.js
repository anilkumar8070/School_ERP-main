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

// Public: list uploaded forms/resources for download (used on Start page)
router.get("/", async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const items = await prisma.resource.findMany({
      orderBy: {
        createdAt: "desc"
      }
    }).catch(() => []);
    const customForms = await prisma.customForm.findMany({
      where: {
        status: 'active'
      },

      orderBy: {
        createdAt: "desc"
      }
    }).catch(() => []);
    const mappedResources = (items || []).map(it => ({
      _id: it._id,
      kind: 'resource',
      title: it.title || it.originalname || it.filename,
      filename: it.filename,
      url: `/uploads/${it.filename}`,
      createdAt: it.createdAt
    }));
    const mappedCustom = (customForms || []).map(form => ({
      _id: form._id,
      kind: 'custom',
      title: form.title,
      category: form.category,
      description: form.description,
      fields: form.fields || [],
      createdAt: form.createdAt
    }));
    return res.json([...mappedCustom, ...mappedResources]);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: custom form builder

  return router;
};
