
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

// Admin: create/generate a certificate (multipart: optional signature image + optional uploaded file)

// List certificates (admin)

// List my certificates (recipient)

// Messages (Parent -> Admin)

// Faculty: request deletion of a student (creates a DeletionRequest)

// Admin: list deletion requests

// Admin: approve a deletion request (deletes the student and associated user)

// Bulk test creation from a .docx file (parses questions/options/answers/marks)

// Parse an uploaded .docx or .pdf and return parsed questions without creating DB records

// Create multiple questions for an existing test (admin/faculty)
router.post("/", verifyToken, requireRole('admin'), upload.fields([{
  name: 'file'
}, {
  name: 'signature'
}]), async (req, res) => {
  try {
    const {
      schoolName,
      title,
      recipientId,
      recipientType,
      recipientName,
      certificationFor,
      dateOfIssue
    } = req.body || {};
    if (!recipientName) return res.status(400).json({
      message: 'recipientName required'
    });

    // prepare doc
    const doc = {
      schoolName: schoolName || '',
      title: title || '',
      recipientId: recipientId || null,
      recipientType: recipientType || 'User',
      recipientName: recipientName || '',
      certificationFor: certificationFor || '',
      dateOfIssue: dateOfIssue || '',
      uploadedBy: req.user && req.user.sub
    };

    // if client uploaded a file (PDF/DOC) just save and reference it
    if (req.files && req.files.file && req.files.file.length > 0) {
      const f = req.files.file[0];
      doc.mime = f.mimetype;
      doc.filePath = `/uploads/${f.filename}`;
    }

    // handle signature upload if provided
    if (req.files && req.files.signature && req.files.signature.length > 0) {
      const s = req.files.signature[0];
      doc.signaturePath = `/uploads/${s.filename}`;
    } else if (req.body.signaturePath) {
      doc.signaturePath = req.body.signaturePath;
    }

    // Try to resolve recipientId (Student/Faculty) to a login User id so recipients can fetch their certificates
    try {
      if (doc.recipientType === 'Student' && doc.recipientId) {
        const Student = require('./models/Student');
        const student = await Student.findById(doc.recipientId).lean().catch(() => null);
        if (student && student.email) {
          const user = await User.findOne({
            username: student.email
          }).lean().catch(() => null);
          if (user) {
            doc.recipientId = user._id;
          }
        }
      } else if (doc.recipientType === 'Faculty' && doc.recipientId) {
        const Faculty = require('./models/Faculty');
        const faculty = await Faculty.findById(doc.recipientId).lean().catch(() => null);
        if (faculty && faculty.email) {
          const user = await User.findOne({
            username: faculty.email
          }).lean().catch(() => null);
          if (user) {
            doc.recipientId = user._id;
          }
        }
      } else {
        // if recipientType is 'User' or other, leave as-is
      }
    } catch (e) {
      console.warn('Failed to resolve recipient to user id', e && e.message);
    }

    // If no file uploaded, attempt to generate a PDF certificate here (using pdfkit)
    if (!doc.filePath) {
      try {
        // pdfkit require consolidated at top of file
        const fname = Date.now() + `_certificate.pdf`;
        const outPath = path.join(uploadsDir, fname);
        const pdfDoc = new PDFDocument({
          size: 'A4',
          margin: 50
        });
        const stream = fs.createWriteStream(outPath);
        pdfDoc.pipe(stream);

        // Improved colorful certificate layout
        const W = pdfDoc.page.width;
        const H = pdfDoc.page.height;

        // Outer colored border
        const outerPad = 24;
        pdfDoc.save();
        pdfDoc.lineWidth(6).strokeColor('#2563eb');
        pdfDoc.roundedRect(outerPad, outerPad, W - outerPad * 2, H - outerPad * 2, 12).stroke();
        pdfDoc.restore();

        // Inner subtle border
        pdfDoc.save();
        pdfDoc.lineWidth(1).strokeColor('#cbd5e1');
        pdfDoc.roundedRect(outerPad + 8, outerPad + 8, W - (outerPad + 8) * 2, H - (outerPad + 8) * 2, 8).stroke();
        pdfDoc.restore();

        // Top ribbon/header
        const ribbonHeight = 80;
        pdfDoc.save();
        pdfDoc.rect(outerPad + 10, outerPad + 10, W - (outerPad + 10) * 2, ribbonHeight).fill('#1e293b');
        pdfDoc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold');
        pdfDoc.text(String(doc.schoolName || ''), outerPad + 20, outerPad + 26, {
          width: W - (outerPad + 40),
          align: 'center'
        });
        pdfDoc.restore();

        // Title
        pdfDoc.moveDown(4);
        pdfDoc.fillColor('#0f172a').fontSize(28).font('Helvetica-Bold');
        pdfDoc.text(doc.title || 'Certificate of Appreciation', {
          align: 'center'
        });

        // Decorative line
        pdfDoc.moveDown(0.5);
        const midX = W / 2;
        pdfDoc.strokeColor('#60a5fa').lineWidth(2);
        pdfDoc.moveTo(midX - 80, pdfDoc.y).lineTo(midX + 80, pdfDoc.y).stroke();

        // Subtitle / intro
        pdfDoc.moveDown(1);
        pdfDoc.fillColor('#334155').fontSize(14).font('Helvetica');
        pdfDoc.text('This is to certify that', {
          align: 'center'
        });

        // Recipient name
        pdfDoc.moveDown(0.5);
        pdfDoc.fontSize(26).font('Times-Bold').fillColor('#0b1220');
        pdfDoc.text(String(doc.recipientName || ''), {
          align: 'center'
        });

        // Certification body (wrapped)
        pdfDoc.moveDown(0.8);
        pdfDoc.fontSize(14).font('Helvetica').fillColor('#334155');
        const bodyText = String(doc.certificationFor || '') || 'For outstanding performance and contribution.';
        pdfDoc.text(bodyText, {
          align: 'center',
          width: W - 200,
          lineGap: 4
        });

        // Date and metadata
        pdfDoc.moveDown(2);
        pdfDoc.fontSize(12).fillColor('#111827');
        pdfDoc.text(`Date of Issue: ${doc.dateOfIssue || ''}`, outerPad + 40, pdfDoc.y);

        // Signature area (right side)
        const sigWidth = 160;
        const sigX = W - outerPad - sigWidth - 40;
        const sigY = H - outerPad - 150;
        if (doc.signaturePath) {
          try {
            const fname = String(doc.signaturePath || '').replace(/^\/uploads\//, '');
            const sigPath = path.join(uploadsDir, fname);
            if (fs.existsSync(sigPath)) {
              pdfDoc.image(sigPath, sigX, sigY, {
                width: sigWidth
              });
            }
          } catch (e) {
            console.warn('Failed to attach signature image', e && e.message);
          }
        }
        // signature line and label
        pdfDoc.moveTo(sigX, sigY + 80).lineTo(sigX + sigWidth, sigY + 80).strokeColor('#94a3b8').lineWidth(1).stroke();
        pdfDoc.fontSize(12).fillColor('#334155').text('Authorized Signature', sigX, sigY + 86, {
          width: sigWidth,
          align: 'center'
        });
        pdfDoc.end();
        await new Promise((resolve, reject) => {
          stream.on('finish', resolve);
          stream.on('error', reject);
        });
        doc.filePath = `/uploads/${fname}`;
        doc.mime = 'application/pdf';
      } catch (e) {
        console.warn('Certificate PDF generation failed', e && e.message);
      }
    }
    const created = await Certificate.create(doc);
    return res.status(201).json(created);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.get("/", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await Certificate.find({}).sort({
      uploadedAt: -1
    }).lean().catch(() => []);
    return res.json(list);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.get("/my", verifyToken, async (req, res) => {
  try {
    const userId = req.user && req.user.sub;
    if (!userId) return res.status(401).json({
      message: 'Not authenticated'
    });
    // Also include certificates where recipientName matches the user's name (case-insensitive)
    const uname = req.user && req.user.name ? String(req.user.name).trim() : '';
    const orClauses = [{
      recipientId: userId
    }];
    if (uname) {
      function escapeRegex(s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      orClauses.push({
        recipientName: {
          $regex: `^${escapeRegex(uname)}$`,
          $options: 'i'
        }
      });
    }
    const list = await Certificate.find({
      $or: orClauses
    }).sort({
      uploadedAt: -1
    }).lean().catch(() => []);
    return res.json(list);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

  return router;
};
