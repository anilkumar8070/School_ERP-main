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

// Public: submit a form query for a given uploaded form (optional attachment)
router.post("/", upload.single('attachment'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      formId,
      formTitle,
      name,
      email,
      contact,
      description
    } = req.body || {};
    if (!name || !email) return res.status(400).json({
      message: 'name and email required'
    });
    const doc = await FormQuery.create({
      data: {
        formId: formId || undefined,
        formTitle: formTitle || '',
        name: String(name),
        email: String(email),
        contact: contact ? String(contact) : '',
        description: description ? String(description) : '',
        filename: req.file ? req.file.filename : undefined,
        originalname: req.file ? req.file.originalname : undefined
      }
    });

    // Send admin notification to iitiancraft03@gmail.com & auto-reply to user
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'iitiancraft03@gmail.com';
      await sendMail({
        to: adminEmail,
        subject: `New Form Submission: ${formTitle || 'General Form'} from ${doc.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h3 style="color: #2563eb; margin-top: 0;">New Form Submission Received</h3>
            <p><strong>Form:</strong> ${formTitle || 'N/A'} (ID: ${formId || 'N/A'})</p>
            <p><strong>Applicant Name:</strong> ${doc.name}</p>
            <p><strong>Applicant Email:</strong> ${doc.email}</p>
            <p><strong>Contact:</strong> ${doc.contact || '-'}</p>
            <p><strong>Details / Description:</strong></p>
            <div style="background: #f9fafb; padding: 12px 16px; border-left: 4px solid #2563eb; border-radius: 4px;">
              ${(doc.description || '').replace(/\n/g, '<br/>')}
            </div>
          </div>
        `
      });

      if (doc.email) {
        await sendMail({
          to: doc.email,
          subject: `Form Submission Confirmation — ${formTitle || 'School ERP'}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
              <h3 style="color: #2563eb;">Submission Received!</h3>
              <p>Dear <strong>${doc.name}</strong>,</p>
              <p>Your submission for <strong>${formTitle || 'Form'}</strong> has been received by School ERP administration.</p>
              <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">Contact support at <a href="mailto:${process.env.ADMIN_EMAIL || 'iitiancraft03@gmail.com'}">${process.env.ADMIN_EMAIL || 'iitiancraft03@gmail.com'}</a> if you need further assistance.</p>
            </div>
          `
        });
      }
    } catch (mailErr) {
      console.warn('Failed to send form query emails:', mailErr && mailErr.message);
    }
    return res.status(201).json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Public: submit a built custom form

  return router;
};
