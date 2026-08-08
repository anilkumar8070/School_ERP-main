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

// Parent/Admin: get receipts by studentId
router.get("/receipts/by-student/:id", verifyToken, requireRole(['admin', 'parent', 'faculty']), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({
      message: 'student id required'
    });
    const student = await prisma.student.findUnique({
      where: {
        id: String(id)
      }
    }).catch(() => null);
    if (!student) return res.status(404).json({
      message: 'Student not found'
    });
    if ((req.user && req.user.role) === 'parent') {
      const parent = await prisma.user.findUnique({
        where: {
          id: String(req.user.sub)
        }
      }).catch(() => null);
      const linked = parent && Array.isArray(parent.parentOf) && parent.parentOf.some(x => String(x) === String(id));
      if (!linked) return res.status(403).json({
        message: 'Parent is not linked to this student'
      });
    }
    // find receipts primarily by email (how receipts are recorded)
    const items = await prisma.receipt.findMany({
      where: {
        OR: [{
          studentEmail: student.email
        }, {
          studentId: ((student.id || student._id))
        }]
      },

      orderBy: {
        createdAt: "desc"
      }
    });
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Parent/Admin: basic student info (limited fields)

// Get fee structure (admin) - returns all class+section entries

// Public: get fee for a class/section (authenticated users)

// Set or update fee for a class+section (creates history entry)

// Delete a specific history entry for a fee-structure (admin)

// Admin: list receipts

// Student: get their receipts

// NOTE: Student route consolidated earlier. Removed duplicate handler to avoid
// multiple handlers for the same path which can produce unexpected behavior.

// Create Razorpay order (requires RAZORPAY_KEY_ID and SECRET in env)

// Debug: report whether Razorpay env vars are present (development helper - does not return secrets)

// Assign a fee to students in a class/section (admin)

// Confirm payment (verify signature) and create Receipt

// admin-only route example

// Complaints

// Events

// Meetings
// Admin can create meetings targeted to students (all / class / section / specific student)

// Admin: list meetings

// My meetings - for students (and generic for other roles)

// Students - list/filter (admin or faculty)

// Admin: create student directly (auto-assign section and rollNo, create login user and email credentials)

// Create an assignment (faculty)

// List assignments (students and faculty). Query by class and section.

// Test Management
// Create a test series (admin or faculty). Supports optional file upload (e.g., CSV or resources)

// Admin: list all tests

// Update a test series (admin or faculty). Faculty may only update tests they created.

// Delete a test series (admin or faculty who created it)

// Get tests relevant to the requesting user (faculty/admin see created or all, students see assigned)

// Get results for a test (admin or faculty)

// Subjective review routes removed (feature deleted)

// Return questions for a test - allow student, admin and faculty (do not expose correct answers to students)
// Admins/faculty can also fetch questions for management purposes; correct answers are not included here.

// Student submits answers for a test; server grades and stores a TestResult

// Student forfeits test (e.g., leaves tab/window) — create a zero-score TestResult

// Upload bulk results as CSV and import into TestResult docs (admin/faculty)

// Parent/Admin: get test results for a specific student

// Student: submit an assignment answer (file optional)

// Leaves: student apply for leave

// Get leaves: admins see all, others see their own

// Get my leaves (explicit)

// Update leave status (admin only) - accept optional note

// Admin: upload syllabus for a class/section

// Admin: create a notice (target one or more roles)
// Admin: create a notice (target one or more roles) - supports optional PDF upload and student filters

// Get notices: admin can optionally filter by role via ?role=student|faculty|parent

// Public: get syllabus for a class and section (match specific section or ALL)

// Admin: delete a syllabus entry (and its uploaded file)

// Faculty: upload a resource (PDF) for students
// Allow faculty and admin to upload resources (admin can upload forms)

// Authenticated: list resources (students and faculty)

// Faculty/Admin: delete a resource. Faculty can delete only their own uploads.

// Public: list uploaded forms/resources for download (used on Start page)

// Admin: custom form builder

// Public: submit a form query for a given uploaded form (optional attachment)

// Public: submit a built custom form

// Public: submit a contact query (from Start page contact button)

// Admin: list submitted contact queries

// Admin: update status of a contact query and optionally notify

// Admin: list submitted form queries

// Admin: compute student rank analytics by class/section
router.get("/fee-structure", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const items = await prisma.feeStructure.findMany();
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.get("/fee-structure/public", verifyToken, async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const cls = req.query.class || req.query.cls || req.query.k || null;
    const section = req.query.section || req.query.sec || 'ALL';
    if (!cls) return res.json([]);
    const classValues = classAliases(cls);
    // try exact section first
    let item = await prisma.feeStructure.findFirst({
      where: {
        class: {
          in: classValues
        },
        section
      }
    });
    if (!item && section !== 'ALL') {
      // fallback to ALL
      item = await prisma.feeStructure.findFirst({
        where: {
          class: {
            in: classValues
          },
          section: 'ALL'
        }
      });
    }
    if (!item) return res.json([]);
    return res.json([item]);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.post("/fee-structure", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      class: cls,
      section = 'ALL',
      term1 = 0,
      term2 = 0,
      note = '',
      term1DueDate = '',
      term2DueDate = '',
      term1FineMode = 'none',
      term1FineAmount = 0,
      term2FineMode = 'none',
      term2FineAmount = 0
    } = req.body || {};
    if (!cls) return res.status(400).json({
      message: 'class required'
    });
    const sec = section || 'ALL';
    const existing = await prisma.feeStructure.findFirst({
      where: {
        class: String(cls),
        section: sec
      }
    });
    const actor = req.user && (req.user.name || req.user.username) || 'admin';
    if (existing) {
      // push history entry with previous values
      existing.history = existing.history || [];
      existing.history.push({
        by: actor,
        at: new Date(),
        term1: existing.term1,
        term2: existing.term2,
        note,
        term1DueDate: existing.term1DueDate || '',
        term2DueDate: existing.term2DueDate || '',
        term1FineMode: existing.term1FineMode || 'none',
        term1FineAmount: existing.term1FineAmount || 0,
        term2FineMode: existing.term2FineMode || 'none',
        term2FineAmount: existing.term2FineAmount || 0
      });
      existing.term1 = Number(term1 || 0);
      existing.term2 = Number(term2 || 0);
      existing.term1DueDate = term1DueDate || '';
      existing.term2DueDate = term2DueDate || '';
      existing.term1FineMode = term1FineMode || 'none';
      existing.term1FineAmount = Number(term1FineAmount || 0);
      existing.term2FineMode = term2FineMode || 'none';
      existing.term2FineAmount = Number(term2FineAmount || 0);
      // Transpiled save()
    if (existing) {
      const { id: _unused_id, _id: _unused__id, save: _unused_save, toObject: _unused_toObject, ..._updateData } = existing;
      
      // Clean out relational arrays if any to prevent Prisma crash
      for (const k in _updateData) {
        if (Array.isArray(_updateData[k]) && _updateData[k].length > 0 && typeof _updateData[k][0] === 'object') {
           delete _updateData[k];
        }
      }

      await prisma.feeStructure.update({
        where: { id: String(((existing.id || existing._id))) },
        data: _updateData
      }).catch(e => console.error("Transpiled save error:", e.message));
    }
      // Auto-propagate assignment to students for this class/section
      try {
        const studentQuery = {
          class: {
            in: classAliases(cls)
          }
        };
        if (sec && sec !== 'ALL') studentQuery.section = sec;
        // Term1 handling
        if (Number(term1 || 0) > 0) {
          const students = await prisma.student.findMany({
            where: studentQuery
          });
          for (const s of students || []) {
            const id = ((s.id || s._id));
            const hasT1 = Array.isArray(s.assignedFees) && s.assignedFees.some(f => String(f.term).toLowerCase().replace(/\s+/g, '') === 'term1');
            
            let fees = Array.isArray(s.assignedFees) ? s.assignedFees : [];
            const idx = fees.findIndex(f => String(f.term).toLowerCase().replace(/\s+/g, '') === 'term1');
            if (idx !== -1) {
               fees[idx].amount = Number(term1);
               fees[idx].assignedAt = new Date();
               fees[idx].by = actor;
            } else {
               fees.push({ term: 'Term1', amount: Number(term1), note: String(note || ''), by: actor, assignedAt: new Date() });
            }
            await prisma.student.update({ where: { id }, data: { assignedFees: fees } });

          }
        } else {
          
          // remove Term1 assignment if amount is 0
          const studentsToRemove = await prisma.student.findMany({ where: studentQuery });
          for (const sToRemove of studentsToRemove) {
             let fees = Array.isArray(sToRemove.assignedFees) ? sToRemove.assignedFees : [];
             const filtered = fees.filter(f => String(f.term).toLowerCase().replace(/\s+/g, '') !== 'term1');
             await prisma.student.update({ where: { id: sToRemove.id }, data: { assignedFees: filtered } });
          }

        }
        // Term2 handling
        if (Number(term2 || 0) > 0) {
          const students = await prisma.student.findMany({
            where: studentQuery
          });
          for (const s of students || []) {
            const id = ((s.id || s._id));
            const hasT2 = Array.isArray(s.assignedFees) && s.assignedFees.some(f => String(f.term).toLowerCase().replace(/\s+/g, '') === 'term2');
            
            let fees2 = Array.isArray(s.assignedFees) ? s.assignedFees : [];
            const idx2 = fees2.findIndex(f => String(f.term).toLowerCase().replace(/\s+/g, '') === 'term2');
            if (idx2 !== -1) {
               fees2[idx2].amount = Number(term2);
               fees2[idx2].assignedAt = new Date();
               fees2[idx2].by = actor;
            } else {
               fees2.push({ term: 'Term2', amount: Number(term2), note: String(note || ''), by: actor, assignedAt: new Date() });
            }
            await prisma.student.update({ where: { id }, data: { assignedFees: fees2 } });

          }
        } else {
          
          // remove Term2 assignment if amount is 0
          const studentsToRemove2 = await prisma.student.findMany({ where: studentQuery });
          for (const sToRemove of studentsToRemove2) {
             let fees = Array.isArray(sToRemove.assignedFees) ? sToRemove.assignedFees : [];
             const filtered = fees.filter(f => String(f.term).toLowerCase().replace(/\s+/g, '') !== 'term2');
             await prisma.student.update({ where: { id: sToRemove.id }, data: { assignedFees: filtered } });
          }

        }
      } catch (propErr) {
        console.warn('Failed to auto-assign fees to students:', propErr && (propErr.message || String(propErr)));
      }
      return res.json(existing);
    }
    const created = await FeeStructure.create({
      data: {
        class: String(cls),
        section: sec,
        term1: Number(term1 || 0),
        term2: Number(term2 || 0),
        term1DueDate: term1DueDate || '',
        term2DueDate: term2DueDate || '',
        term1FineMode: term1FineMode || 'none',
        term1FineAmount: Number(term1FineAmount || 0),
        term2FineMode: term2FineMode || 'none',
        term2FineAmount: Number(term2FineAmount || 0),
        history: [{
          by: actor,
          at: new Date(),
          term1: Number(term1 || 0),
          term2: Number(term2 || 0),
          note,
          term1DueDate: term1DueDate || '',
          term2DueDate: term2DueDate || '',
          term1FineMode: term1FineMode || 'none',
          term1FineAmount: Number(term1FineAmount || 0),
          term2FineMode: term2FineMode || 'none',
          term2FineAmount: Number(term2FineAmount || 0)
        }]
      }
    });
    // Auto-propagate for newly created fee structure
    try {
      const studentQuery = {
        class: {
          in: classAliases(cls)
        }
      };
      if (sec && sec !== 'ALL') studentQuery.section = sec;
      
      if (Number(term1 || 0) > 0) {
          const students = await prisma.student.findMany({ where: studentQuery });
          for (const s of students) {
             let fees = Array.isArray(s.assignedFees) ? s.assignedFees : [];
             fees.push({ term: 'Term1', amount: Number(term1), note: String(note || ''), by: actor, assignedAt: new Date() });
             await prisma.student.update({ where: { id: s.id }, data: { assignedFees: fees } });
          }
      }

      
      if (Number(term2 || 0) > 0) {
          const students = await prisma.student.findMany({ where: studentQuery });
          for (const s of students) {
             let fees = Array.isArray(s.assignedFees) ? s.assignedFees : [];
             fees.push({ term: 'Term2', amount: Number(term2), note: String(note || ''), by: actor, assignedAt: new Date() });
             await prisma.student.update({ where: { id: s.id }, data: { assignedFees: fees } });
          }
      }

    } catch (propErr) {
      console.warn('Failed to auto-assign fees to students (create):', propErr && (propErr.message || String(propErr)));
    }
    return res.json(created);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.delete("/fee-structure/:id/history/:hid", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      id,
      hid
    } = req.params;
    if (!id || !hid) return res.status(400).json({
      message: 'fee id and history id required'
    });

    // Load the document and manipulate history in JS to avoid ObjectId cast errors
    const fee = await prisma.feeStructure.findUnique({
      where: {
        id: String(id)
      }
    });
    if (!fee) return res.status(404).json({
      message: 'Fee structure not found'
    });

    // Try to find by history _id string match
    let removed = false;
    if (fee.history && fee.history.length) {
      // prefer exact _id match (compare as strings)
      const idx = fee.history.findIndex(h => String(((h.id || h._id))) === String(hid));
      if (idx >= 0) {
        fee.history.splice(idx, 1);
        removed = true;
      }
    }

    // If not found, try interpreting hid as an ISO date string and match `at` timestamp
    if (!removed) {
      const maybeDate = new Date(hid);
      if (!isNaN(maybeDate.getTime())) {
        const before = fee.history.length;
        fee.history = fee.history.filter(h => {
          const hAt = h.at ? new Date(h.at) : null;
          return !(hAt && hAt.toISOString() === maybeDate.toISOString());
        });
        if (fee.history.length !== before) removed = true;
      }
    }
    if (!removed) return res.status(404).json({
      message: 'History entry not found'
    });
    // Transpiled save()
    if (fee) {
      const { id: _unused_id, _id: _unused__id, save: _unused_save, toObject: _unused_toObject, ..._updateData } = fee;
      
      // Clean out relational arrays if any to prevent Prisma crash
      for (const k in _updateData) {
        if (Array.isArray(_updateData[k]) && _updateData[k].length > 0 && typeof _updateData[k][0] === 'object') {
           delete _updateData[k];
        }
      }

      await prisma.feeStructure.update({
        where: { id: String(((fee.id || fee._id))) },
        data: _updateData
      }).catch(e => console.error("Transpiled save error:", e.message));
    }
    const updated = await prisma.feeStructure.findUnique({
      where: {
        id: String(id)
      }
    });
    return res.json({
      ok: true,
      fee: updated
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.get("/receipts", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const items = await prisma.receipt.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.get("/receipts/my", verifyToken, async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const items = await prisma.receipt.findMany({
      where: {
        studentEmail: req.user.username
      },

      orderBy: {
        createdAt: "desc"
      }
    });
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.post("/create-order", verifyToken, async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      amount,
      currency = 'INR',
      receipt
    } = req.body || {};
    if (!amount) return res.status(400).json({
      message: 'amount required'
    });
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return res.status(500).json({
      message: 'Razorpay not configured'
    });
    const Razorpay = require('razorpay');
    const rzp = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
    const order = await rzp.orders.create({
      amount: Math.round(Number(amount) * 100),
      currency,
      receipt: receipt || `rcpt_${Date.now()}`
    });
    console.log('Razorpay order created:', order && order.id, 'amount:', order && order.amount);
    return res.json(order);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.post("/assign-fee", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      class: cls,
      section = 'ALL',
      term,
      amount = 0,
      note = ''
    } = req.body || {};
    if (!cls || !term) return res.status(400).json({
      message: 'class and term required'
    });
    // Allow targeting specific student IDs (optional) or class/section filter
    let q = {};
    if (Array.isArray(req.body.studentIds) && req.body.studentIds.length) {
      q = {
        _id: {
          in: req.body.studentIds
        }
      };
    } else {
      q = {
        class: {
          in: classAliases(cls)
        }
      };
      if (section && section !== 'ALL') q.section = section;
    }
    const students = await prisma.student.findMany({
      where: q
    });
    if (!students || students.length === 0) return res.status(404).json({
      message: 'No students found for the selected filter'
    });
    const entry = {
      term: String(term),
      amount: Number(amount || 0),
      note: String(note || ''),
      by: req.user && (req.user.name || req.user.username) || 'admin',
      assignedAt: new Date()
    };

    
    // Push assignedFees entry to matching students
    let matchedCount = 0;
    const targets = await prisma.student.findMany({ where: q });
    for (const s of targets) {
       let fees = Array.isArray(s.assignedFees) ? s.assignedFees : [];
       fees.push(entry);
       await prisma.student.update({ where: { id: s.id }, data: { assignedFees: fees } });
       matchedCount++;
    }
    const r = { matchedCount, modifiedCount: matchedCount };

    for (const student of students) {
      if (student.contact || student.email) {
        await notifyEvent({
          event: 'fee_due',
          phone: student.contact,
          message: `Dear ${student.name}, a new fee for Term ${term} (Amount: ${amount}) has been assigned to your account.`,
          emailOpts: {
            to: student.email,
            subject: 'Fee Due Notification',
            text: `Dear ${student.name}, a new fee for Term ${term} (Amount: ${amount}) has been assigned to your account.`
          }
        });
      }
    }
    return res.json({
      ok: true,
      matched: r.matchedCount || r.n || 0,
      modified: r.modifiedCount || r.nModified || 0,
      assigned: entry
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.post("/confirm-payment", verifyToken, async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      studentId,
      studentName,
      studentEmail,
      class: cls,
      term,
      amount,
      allocationId
    } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return res.status(400).json({
      message: 'payment details required'
    });
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const crypto = require('crypto');
    const generatedSignature = crypto.createHmac('sha256', keySecret).update(razorpay_order_id + '|' + razorpay_payment_id).digest('hex');
    if (generatedSignature !== razorpay_signature) return res.status(400).json({
      message: 'Invalid signature'
    });

    // create receipt record
    const rec = await Receipt.create({
      data: {
        studentId: studentId || null,
        allocationId: allocationId || null,
        studentName: studentName || '',
        studentEmail: studentEmail || req.user && req.user.username || '',
        class: cls || '',
        term: term || '',
        amount: Number(amount || 0),
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature
      }
    });

    // send receipt email to student if email present (with PDF attachment)
    try {
      const to = rec.studentEmail;
      if (to) {
        const subject = `Payment receipt — ${rec.class} ${rec.term} — ₹${rec.amount}`;
        const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || '';
        const html = `
          <div style="font-family:Arial,sans-serif;background:#f7f7fb;padding:20px">
            <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
              <div style="background:linear-gradient(90deg,#06b6d4,#7c3aed);padding:16px;color:white"><h2 style="margin:0">Payment Receipt</h2></div>
              <div style="padding:16px;color:#333">
                <p>Hi ${rec.studentName || rec.studentEmail},</p>
                <p>Thank you. Your payment has been received.</p>
                <table style="width:100%;border-collapse:collapse;margin-top:8px">
                  <tr><td style="font-weight:700;padding:6px 0">Receipt ID</td><td style="padding:6px 0">${((rec.id || rec._id))}</td></tr>
                  <tr><td style="font-weight:700;padding:6px 0">Class</td><td style="padding:6px 0">${rec.class}</td></tr>
                  <tr><td style="font-weight:700;padding:6px 0">Term</td><td style="padding:6px 0">${rec.term}</td></tr>
                  <tr><td style="font-weight:700;padding:6px 0">Amount</td><td style="padding:6px 0">₹${rec.amount}</td></tr>
                  <tr><td style="font-weight:700;padding:6px 0">Date</td><td style="padding:6px 0">${new Date(rec.createdAt).toLocaleString()}</td></tr>
                </table>
                <p style="margin-top:12px">You can view your receipt online: <a href="${frontendUrl}/student/fees">View Receipts</a></p>
              </div>
            </div>
          </div>
        `
        // Generate PDF receipt server-side and attach (fire-and-forget)
        (async () => {
          try {
            // pdfkit require consolidated at top of file
            const buffers = [];
            const doc = new PDFDocument({
              size: 'A4',
              margin: 40
            });
            doc.on('data', b => buffers.push(b));
            doc.on('end', async () => {
              try {
                const pdfData = Buffer.concat(buffers);
                await sendMail({
                  to,
                  subject,
                  html,
                  attachments: [{
                    filename: `receipt_${((rec.id || rec._id))}.pdf`,
                    content: pdfData
                  }]
                }).catch(() => {});
              } catch (e) {
                console.warn('Failed to send mail with attachment', e && (e.message || e));
              }
            });
            // Write receipt content
            doc.fontSize(20).text('School Name', {
              align: 'left'
            });
            doc.moveDown(0.2);
            doc.fontSize(14).text('Hostel Fee Receipt', {
              align: 'left'
            });
            doc.moveDown(1);
            doc.fontSize(12).text(`Receipt ID: ${((rec.id || rec._id))}`);
            doc.text(`Date: ${new Date(rec.createdAt).toLocaleString()}`);
            doc.moveDown(0.5);
            doc.fontSize(12).text(`Student: ${rec.studentName || ''}`);
            doc.text(`Email: ${rec.studentEmail || ''}`);
            doc.text(`Class: ${rec.class || ''}`);
            doc.text(`Term: ${rec.term || ''}`);
            doc.moveDown(0.5);
            // If we have allocation info, include it
            try {
              if (rec.allocationId) {
                const alloc = await prisma.hostelAllocation.findUnique({
                  where: {
                    id: String(rec.allocationId)
                  }
                }).catch(() => null);
                if (alloc) {
                  const hostel = alloc.hostelId && (await prisma.hostel.findUnique({
                    where: {
                      id: String(alloc.hostelId)
                    }
                  }).catch(() => null)) || null;
                  doc.moveDown(0.5);
                  doc.text(`Hostel: ${hostel ? hostel.name || '' : alloc.hostelId || ''}`);
                  doc.text(`Room: ${alloc.floorNo} / ${alloc.roomNo} / ${Number(alloc.bedIndex) + 1}`);
                }
              }
            } catch (e) {}
            doc.moveDown(1);
            doc.fontSize(14).text(`Amount Paid: ₹${rec.amount}`, {
              underline: true
            });
            doc.end();
          } catch (e) {
            console.warn('Failed to generate PDF receipt', e && (e.message || e));
          }
        })();
        // send lightweight email without attachments immediately (attachment arrives asynchronously above)
        await sendMail({
          to,
          subject,
          html
        }).catch(() => {});
      }
    } catch (mailErr) {
      console.warn('Failed to send receipt email:', mailErr && (mailErr.message || String(mailErr)));
    }

    // If this receipt references a hostel allocation, update that allocation's payments and paid flag
    try {
      if (allocationId) {
        const alloc = await prisma.hostelAllocation.findUnique({
          where: {
            id: String(allocationId)
          }
        }).catch(() => null);
        if (alloc) {
          // determine part index from term string e.g., 'Term 1'
          let partIndex = null;
          try {
            const m = String(term || '').match(/(\d+)/);
            if (m) partIndex = Number(m[1]);
          } catch (e) {
            partIndex = null;
          }
          // initialize payments array if missing
          const payments = Array.isArray(alloc.payments) ? alloc.payments : [];
          // if we have partIndex, check for existing entry and update; otherwise push a generic payment
          if (partIndex !== null) {
            const exists = payments.find(p => Number(p.partIndex) === Number(partIndex) && p.paymentId === String(razorpay_payment_id));
            if (!exists) {
              payments.push({
                partIndex: Number(partIndex),
                amount: Number(amount || 0),
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                receiptId: ((rec.id || rec._id)),
                status: 'paid'
              });
            }
          } else {
            payments.push({
              amount: Number(amount || 0),
              orderId: razorpay_order_id,
              paymentId: razorpay_payment_id,
              receiptId: ((rec.id || rec._id)),
              status: 'paid'
            });
          }
          // compute whether all parts are paid
          let paidAll = false;
          try {
            const partsCount = alloc.fee && alloc.fee.parts ? Number(alloc.fee.parts) : 1;
            const paidCount = payments.filter(p => p && p.status === 'paid' && p.partIndex).length;
            // if parts specified and paidCount >= partsCount then mark paid
            if (partsCount && paidCount >= partsCount) paidAll = true;
            // if partsCount == 1 and we have any paid payment, mark paidAll
            if (partsCount === 1 && payments.length > 0) paidAll = true;
          } catch (e) {
            paidAll = false;
          }
          await prisma.hostelAllocation.update({
            where: {
              id: String(allocationId)
            },

            data: {
              payments: payments,
              paid: !!paidAll
            }
          }).catch(() => null);
        }
      }
    } catch (e) {
      console.warn('Failed to update allocation from receipt', e && (e.message || e));
    }

    // emit SSE for admin UIs
    try {
      sendSseEvent('receipt_created', {
        id: ((rec.id || rec._id)),
        email: rec.studentEmail,
        name: rec.studentName,
        amount: rec.amount
      });
    } catch (e) {}
    return res.json({
      ok: true,
      receipt: rec
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

  return router;
};
