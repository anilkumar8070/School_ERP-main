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

// Public: submit a built custom form
router.post("/", upload.any(), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      formId,
      responses
    } = req.body || {};
    if (!formId) return res.status(400).json({
      message: 'formId required'
    });
    const form = await prisma.customForm.findUnique({
      where: {
        id: String(formId)
      }
    }).catch(() => null);
    if (!form || form.status !== 'active') return res.status(404).json({
      message: 'Form not available'
    });
    let parsedResponses = {};
    try {
      parsedResponses = responses ? JSON.parse(responses) : {};
    } catch (e) {
      parsedResponses = {};
    }
    for (const field of form.fields || []) {
      if (!field.required) continue;
      const value = parsedResponses[String(((field.id || field._id)))];
      const hasValue = Array.isArray(value) ? value.length > 0 : String(value || '').trim() !== '';
      if (!hasValue && field.type !== 'file') return res.status(400).json({
        message: `${field.label} is required`
      });
    }
    const fileFields = (req.files || []).map(file => {
      const fieldId = String(file.fieldname || '').replace(/^file_/, '');
      const field = (form.fields || []).find(item => String(((item.id || item._id))) === fieldId) || {};
      return {
        fieldId,
        fieldLabel: field.label || 'Attachment',
        filename: file.filename,
        originalname: file.originalname
      };
    });
    const labeledResponses = {};
    (form.fields || []).forEach(field => {
      if (field.type === 'file') return;
      const key = String(((field.id || field._id)));
      if (parsedResponses[key] !== undefined) labeledResponses[field.label || key] = parsedResponses[key];
    });
    const firstEmailField = (form.fields || []).find(field => field.type === 'email');
    const firstPhoneField = (form.fields || []).find(field => field.type === 'phone');
    const firstNameField = (form.fields || []).find(field => /name/i.test(String(field.label || '')));
    const doc = await FormQuery.create({
      data: {
        formId,
        formTitle: form.title,
        formType: 'custom',
        name: firstNameField ? String(parsedResponses[String(((firstNameField.id || firstNameField._id)))] || 'Form submission') : 'Form submission',
        email: firstEmailField ? String(parsedResponses[String(((firstEmailField.id || firstEmailField._id)))] || 'no-email@example.com') : 'no-email@example.com',
        contact: firstPhoneField ? String(parsedResponses[String(((firstPhoneField.id || firstPhoneField._id)))] || '') : '',
        description: form.description || '',
        responses: labeledResponses,
        attachments: fileFields,
        filename: fileFields[0] && fileFields[0].filename,
        originalname: fileFields[0] && fileFields[0].originalname
      }
    });

    // Send admin notification & user auto-reply
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'iitiancraft03@gmail.com';
      await sendMail({
        to: adminEmail,
        subject: `New Custom Form Response: ${form.title} from ${doc.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h3 style="color: #2563eb;">New Response Received for ${form.title}</h3>
            <p><strong>Applicant:</strong> ${doc.name}</p>
            <p><strong>Email:</strong> ${doc.email}</p>
            <p><strong>Contact:</strong> ${doc.contact || '-'}</p>
            <p><strong>Submitted Data:</strong></p>
            <pre style="background: #f9fafb; padding: 12px; border-radius: 4px; border: 1px solid #e5e7eb;">${JSON.stringify(labeledResponses, null, 2)}</pre>
          </div>
        `
      });

      if (doc.email && doc.email !== 'no-email@example.com') {
        await sendMail({
          to: doc.email,
          subject: `Confirmation — ${form.title} Received`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
              <h3 style="color: #2563eb;">Form Submission Received!</h3>
              <p>Dear <strong>${doc.name}</strong>,</p>
              <p>Thank you for submitting your response for <strong>${form.title}</strong>.</p>
              <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">Contact support at <a href="mailto:${process.env.ADMIN_EMAIL || 'iitiancraft03@gmail.com'}">${process.env.ADMIN_EMAIL || 'iitiancraft03@gmail.com'}</a>.</p>
            </div>
          `
        });
      }
    } catch (mailErr) {
      console.warn('Failed to send custom form query emails:', mailErr && mailErr.message);
    }

    return res.status(201).json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Public: submit a contact query (from Start page contact button)

  return router;
};
