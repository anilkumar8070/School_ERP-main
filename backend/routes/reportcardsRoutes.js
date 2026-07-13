
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

// List current user's report cards
router.get("/my", verifyToken, async (req, res) => {
  try {
    const username = req.user && req.user.username;
    const userId = req.user && req.user.sub;
    const filter = {
      $or: []
    };
    if (userId) filter.$or.push({
      recipientId: userId
    });
    if (username) filter.$or.push({
      recipientEmail: {
        $regex: new RegExp('^' + username + '$', 'i')
      }
    });
    // If this user is a student, also attempt to find the Student document and match by its id
    try {
      if (username) {
        const stud = await Student.findOne({
          email: username
        }).lean().catch(() => null);
        if (stud && stud._id) filter.$or.push({
          recipientId: String(stud._id)
        });
      }
    } catch (e) {/* ignore */}
    // If no filters could be assembled, return empty
    if (!filter.$or || filter.$or.length === 0) return res.json([]);
    const list = await ReportCard.find(filter).sort({
      createdAt: -1
    }).lean().catch(() => []);
    return res.json(list || []);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Download a specific report card file (streamed with auth)
router.get("/:id/download", verifyToken, async (req, res) => {
  try {
    const id = req.params && req.params.id;
    if (!id) return res.status(400).json({
      message: 'id required'
    });
    const rc = await ReportCard.findById(id).lean().catch(() => null);
    if (!rc) return res.status(404).json({
      message: 'Report card not found'
    });
    // Authorization: allow owner by email or id, or admin/faculty roles
    try {
      const user = req.user || {};
      const isOwnerById = user.sub && String(user.sub) === String(rc.recipientId);
      const isOwnerByEmail = user.username && String(user.username).toLowerCase() === String(rc.recipientEmail || '').toLowerCase();
      const isPrivileged = user && user.role && (String(user.role) === 'admin' || String(user.role) === 'faculty' || Array.isArray(user.roles) && (user.roles.includes('admin') || user.roles.includes('faculty')));
      if (!isOwnerById && !isOwnerByEmail && !isPrivileged) return res.status(403).json({
        message: 'Forbidden'
      });
    } catch (e) {/* fallthrough to forbidden */}

    // If a remote URL is provided, proxy the file
    if (rc.filePath && String(rc.filePath).toLowerCase().startsWith('http')) {
      // Simple proxy: fetch remote URL and pipe
      try {
        const fetch = require('node-fetch');
        const remote = String(rc.filePath);
        const rres = await fetch(remote);
        if (!rres.ok) return res.status(502).json({
          message: 'Failed to fetch remote file'
        });
        res.setHeader('Content-Type', rc.mime || 'application/octet-stream');
        const fname = remote.split('/').pop() || `report_${id}.pdf`;
        res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
        rres.body.pipe(res);
        return;
      } catch (e) {
        console.warn('Remote proxy failed', e);
        return res.status(500).json({
          message: 'Failed to proxy remote file'
        });
      }
    }
    if (!rc.filePath) return res.status(404).json({
      message: 'No file available for this report card'
    });
    // Resolve local path (strip leading slashes)
    const rel = String(rc.filePath).replace(/^\/+/, '');
    const full = path.join(__dirname, rel);
    // Ensure file exists
    const fs = require('fs');
    if (!fs.existsSync(full)) return res.status(404).json({
      message: 'File not found on server'
    });
    const filename = rel.split('/').pop() || `report_${id}.pdf`;
    res.setHeader('Content-Type', rc.mime || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.sendFile(full);
  } catch (e) {
    console.error('Report card download failed', e);
    return res.status(500).json({
      message: e.message
    });
  }
});
// Create a report card (admin/faculty)
router.post("/", verifyToken, requireRole(['admin', 'faculty']), upload.single('signature'), async (req, res) => {
  try {
    const payload = req.body || {};
    const {
      schoolName = '',
      examName = '',
      className = '',
      section = '',
      recipientName = '',
      recipientEmail = '',
      rollNumber = '',
      templateType = 'normal',
      subjects = []
    } = payload;
    // basic validation
    if (!recipientEmail && !recipientName) return res.status(400).json({
      message: 'recipientName or recipientEmail required'
    });

    // create a DB document; file generation (PDF) will be attempted and filePath set if successful
    const doc = await ReportCard.create({
      schoolName,
      examName,
      className,
      section,
      recipientName,
      recipientEmail,
      rollNumber,
      templateType,
      subjects,
      createdBy: req.user && req.user.sub
    });

    // handle signature upload (if provided)
    if (req.file && req.file.filename) {
      try {
        const sigF = req.file.filename;
        const sigPath = `/uploads/${sigF}`;
        await ReportCard.findByIdAndUpdate(doc._id, {
          signaturePath: sigPath
        }).catch(() => null);
        // update doc object for immediate PDF generation
        doc.signaturePath = sigPath;
      } catch (e) {
        console.warn('Failed to save signature path', e && e.message);
      }
    }

    // Try to generate a simple PDF using pdfkit if available
    try {
      if (PDFDocument) {
        const fname = `${Date.now()}_report_${String(doc._id).slice(-6)}.pdf`;
        const outPath = path.join(uploadsDir, fname);
        const stream = fs.createWriteStream(outPath);
        const pdf = new PDFDocument({
          size: 'A4',
          margin: 40
        });
        pdf.pipe(stream);
        // Header
        pdf.rect(0, 0, pdf.page.width, 90).fill('#0B5FFF');
        pdf.fillColor('white').fontSize(20).text(String(schoolName || 'School Name'), 50, 24);
        pdf.fontSize(12).text(String(examName || ''), 50, 48);
        pdf.restore();
        pdf.moveDown(2);
        pdf.fillColor('#000').fontSize(12);
        pdf.text(`Name: ${recipientName || ''}`);
        pdf.text(`Class: ${className || ''}    Section: ${section || ''}    Roll No: ${rollNumber || ''}`);
        pdf.moveDown(1);
        pdf.text('Subjects', {
          underline: true
        });
        let totalObt = 0,
          totalMax = 0;
        subjects.forEach((s, idx) => {
          const m = Number(s.marks || 0);
          const mm = Number(s.maxMarks || 0) || 100;
          totalObt += m;
          totalMax += mm;
          pdf.text(`${idx + 1}. ${s.name || ''} — ${m} / ${mm}`);
        });
        const perc = totalMax ? Math.round(totalObt / totalMax * 100 * 100) / 100 : 0;
        pdf.moveDown(1);
        pdf.text(`Total: ${totalObt} / ${totalMax}`);
        pdf.text(`Percentage: ${perc}%`);
        // attach signature image if available
        try {
          if (doc.signaturePath) {
            const sigFile = String(doc.signaturePath || '').replace(/^\/uploads\//, '');
            const sigAbs = path.join(uploadsDir, sigFile);
            if (fs.existsSync(sigAbs)) {
              const sigWidth = 160;
              const sigX = pdf.page.width - 60 - sigWidth;
              const sigY = pdf.y;
              pdf.image(sigAbs, sigX, sigY, {
                width: sigWidth
              });
              pdf.moveDown(6);
            }
          }
        } catch (e) {/* ignore signature embed errors */}
        pdf.moveDown(4);
        pdf.text('Controller Signature:', {
          align: 'right'
        });
        pdf.end();
        await new Promise(resolve => stream.on('finish', resolve));
        doc.filePath = `/uploads/${fname}`;
        doc.mime = 'application/pdf';
        await doc.save();
        try {
          const s = await Student.findOne({
            email: recipientEmail
          }).lean();
          const phone = s ? s.contact : null;
          await notifyEvent({
            event: 'exam_result',
            phone,
            message: `Report card generated for ${examName}. View on portal.`,
            emailOpts: {
              to: recipientEmail,
              subject: `Report Card: ${examName}`,
              text: `Your report card for ${examName} is available.`
            }
          });
        } catch (e) {}
      }
    } catch (e) {
      console.warn('Failed to generate report card PDF', e && e.message);
    }
    return res.status(201).json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// List all report cards (admin)
router.get("/", verifyToken, requireRole(['admin', 'faculty']), async (req, res) => {
  try {
    const list = await ReportCard.find({}).sort({
      createdAt: -1
    }).lean().catch(() => []);
    return res.json(list);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// List report cards for current user (student)
router.get("/my", verifyToken, requireRole('student'), async (req, res) => {
  try {
    const userId = req.user && req.user.sub;
    if (!userId) return res.status(401).json({
      message: 'Not authenticated'
    });
    const list = await ReportCard.find({
      recipientEmail: req.user.username
    }).sort({
      createdAt: -1
    }).lean().catch(() => []);
    return res.json(list);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Parent/Admin/Student: list report cards for a specific student
router.get("/by-student/:id", verifyToken, requireRole(['student', 'parent', 'admin', 'faculty']), async (req, res) => {
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
    const list = await ReportCard.find({
      $or: [{
        recipientEmail: student.email
      }, {
        recipientId: student._id
      }, {
        recipientName: student.name,
        className: student.class,
        section: student.section
      }, {
        rollNumber: student.rollNo,
        className: student.class,
        section: student.section
      }]
    }).sort({
      createdAt: -1
    }).lean().catch(() => []);
    return res.json(list);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Student/Parent/Admin: rank summary for one student within class-section

// Download report card file
router.get("/:id/download", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({
      message: 'id required'
    });
    const doc = await ReportCard.findById(id).lean().catch(() => null);
    if (!doc || !doc.filePath) return res.status(404).json({
      message: 'File not found'
    });
    const fp = String(doc.filePath || '').replace(/^\//, '');
    const filename = path.basename(fp);
    let abs = path.join(uploadsDir, filename);

    // If file missing or filePath empty, attempt to generate PDF on-demand (and save reference)
    if (!doc.filePath || !fs.existsSync(abs)) {
      if (!PDFDocument) return res.status(404).json({
        message: 'File missing on server and PDF generator not available'
      });
      try {
        // generate a PDF from the saved doc data
        const fname = `${Date.now()}_report_${String(id).slice(-6)}.pdf`;
        abs = path.join(uploadsDir, fname);
        const stream = fs.createWriteStream(abs);
        const pdf = new PDFDocument({
          size: 'A4',
          margin: 40
        });
        pdf.pipe(stream);
        pdf.rect(0, 0, pdf.page.width, 90).fill('#0B5FFF');
        pdf.fillColor('white').fontSize(20).text(String(doc.schoolName || 'School Name'), 50, 24);
        pdf.fontSize(12).text(String(doc.examName || ''), 50, 48);
        pdf.restore();
        pdf.moveDown(2);
        pdf.fillColor('#000').fontSize(12);
        pdf.text(`Name: ${doc.recipientName || ''}`);
        pdf.text(`Class: ${doc.className || ''}    Section: ${doc.section || ''}    Roll No: ${doc.rollNumber || ''}`);
        pdf.moveDown(1);
        pdf.text('Subjects', {
          underline: true
        });
        let totalObt = 0,
          totalMax = 0(doc.subjects || []).forEach((s, idx) => {
            const m = Number(s.marks || 0);
            const mm = Number(s.maxMarks || 0) || 100;
            totalObt += m;
            totalMax += mm;
            pdf.text(`${idx + 1}. ${s.name || ''} — ${m} / ${mm}`);
          });
        const perc = totalMax ? Math.round(totalObt / totalMax * 100 * 100) / 100 : 0;
        pdf.moveDown(1);
        pdf.text(`Total: ${totalObt} / ${totalMax}`);
        pdf.text(`Percentage: ${perc}%`);
        pdf.moveDown(4);
        pdf.text('Controller Signature:', {
          align: 'right'
        });
        pdf.end();
        await new Promise((resolve, reject) => {
          stream.on('finish', resolve);
          stream.on('error', reject);
        });

        // update DB document with filePath
        try {
          await ReportCard.findByIdAndUpdate(id, {
            filePath: `/uploads/${fname}`,
            mime: 'application/pdf'
          }).catch(() => null);
        } catch (e) {
          console.warn('Failed to update reportcard doc with filePath', e && e.message);
        }
      } catch (e) {
        console.warn('Failed to generate reportcard PDF on-demand', e && e.message);
        return res.status(500).json({
          message: 'Failed to generate PDF'
        });
      }
    }
    return res.download(abs, filename, err => {
      if (err) console.warn('Failed to send reportcard file', err && err.message);
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
// Staff Attendance APIs

  return router;
};
