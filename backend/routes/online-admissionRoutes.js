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
    similarity, PDFDocument, fs, path, bcrypt, jwt, sendMail
  } = helpers;

// ===================== Online Admission APIs =====================
router.post("/", upload.single('document'), async (req, res) => {
  try {
    const payload = req.body || {};
    const required = ['studentName', 'dob', 'gender', 'address', 'parentName', 'parentPhone', 'classApplying'];
    for (const k of required) {
      if (!payload[k]) return res.status(400).json({
        message: `${k} required`
      });
    }
    const file = req.file;
    const filePath = file ? `/uploads/${file.filename}` : '';
    const doc = await OnlineAdmission.create({
      data: {
        ...payload,
        documentPath: filePath
      }
    });

    // Send admin notification to iitiancraft03@gmail.com & user receipt
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'iitiancraft03@gmail.com';
      const applicantEmail = payload.email || payload.parentEmail;

      await sendMail({
        to: adminEmail,
        subject: `New Online Admission Application: ${payload.studentName}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h3 style="color: #2563eb;">New Online Admission Application Received</h3>
            <p><strong>Student Name:</strong> ${payload.studentName}</p>
            <p><strong>Class Applying:</strong> Class ${payload.classApplying}</p>
            <p><strong>Parent Name:</strong> ${payload.parentName}</p>
            <p><strong>Parent Phone:</strong> ${payload.parentPhone}</p>
            <p><strong>Email:</strong> ${applicantEmail || '-'}</p>
            <p><strong>Date of Birth:</strong> ${payload.dob}</p>
            <p><strong>Gender:</strong> ${payload.gender}</p>
            <p><strong>Address:</strong> ${payload.address}</p>
          </div>
        `
      });

      if (applicantEmail) {
        await sendMail({
          to: applicantEmail,
          subject: `Online Admission Application Received — School ERP`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
              <h3 style="color: #2563eb;">Application Received!</h3>
              <p>Dear <strong>${payload.parentName}</strong>,</p>
              <p>We have successfully received the online admission application for <strong>${payload.studentName}</strong> (Class ${payload.classApplying}).</p>
              <p>Our admissions committee will review the details and reach out to you at <strong>${payload.parentPhone}</strong>.</p>
              <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">Contact admissions support at <a href="mailto:${process.env.ADMIN_EMAIL || 'iitiancraft03@gmail.com'}">${process.env.ADMIN_EMAIL || 'iitiancraft03@gmail.com'}</a>.</p>
            </div>
          `
        });
      }
    } catch (mailErr) {
      console.warn('Failed to send online admission emails:', mailErr && mailErr.message);
    }

    return res.status(201).json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.get("/", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await prisma.onlineAdmission.findMany({
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

// ===================== Discount Management APIs =====================

  return router;
};
