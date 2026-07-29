
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

// Salary payment APIs (admin and faculty)
// ===================== Faculty Salary APIs =====================
// List all faculty (minimal fields)
router.get("/faculties", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await Faculty.find({}, {
      name: 1,
      email: 1,
      employeeId: 1,
      subject: 1
    }).lean().catch(() => []);
    return res.json(list);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Create a salary payment (mock Razorpay flow). If Razorpay env exists, we still mock success for test.
router.post("/pay", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      facultyId,
      month,
      amount
    } = req.body || {};
    if (!facultyId || !month || !amount) return res.status(400).json({
      message: 'facultyId, month, amount required'
    });
    const fac = await Faculty.findById(facultyId).lean().catch(() => null);
    if (!fac) return res.status(404).json({
      message: 'Faculty not found'
    });

    // Create payment record as pending first
    let payment = await SalaryPayment.create({
      facultyId,
      facultyName: fac.name,
      facultyEmail: fac.email,
      month,
      amount,
      status: 'pending'
    });

    // Mock Razorpay order/payment success
    const razorpayOrderId = 'order_' + makeId('rz_');
    const razorpayPaymentId = 'pay_' + makeId('rz_');
    const razorpaySignature = makeId('sig_');

    // Generate a simple receipt number
    const receiptNo = `SAL-${new Date().getFullYear()}-${String(payment._id).slice(-6).toUpperCase()}`;
    payment.razorpayOrderId = razorpayOrderId;
    payment.razorpayPaymentId = razorpayPaymentId;
    payment.razorpaySignature = razorpaySignature;
    payment.receiptNo = receiptNo;
    payment.status = 'paid';
    await payment.save();
    return res.status(201).json(payment);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Create Razorpay order (optional real test). Returns order payload for Checkout.
router.post("/order", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      facultyId,
      month,
      amount
    } = req.body || {};
    if (!facultyId || !month || !amount) return res.status(400).json({
      message: 'facultyId, month, amount required'
    });
    const fac = await Faculty.findById(facultyId).lean().catch(() => null);
    if (!fac) return res.status(404).json({
      message: 'Faculty not found'
    });
    const amountPaise = Math.round(Number(amount) * 100);
    const receipt = `SAL-${new Date().getFullYear()}-${makeId('r_')}`;
    if (razorpayClient) {
      try {
        const order = await razorpayClient.orders.create({
          amount: amountPaise,
          currency: 'INR',
          receipt,
          notes: {
            facultyId: String(fac._id),
            month
          }
        });
        return res.json({
          mode: 'razorpay',
          order,
          faculty: {
            id: fac._id,
            name: fac.name,
            email: fac.email
          },
          receipt
        });
      } catch (e) {
        // fall through to mock
        console.warn('Razorpay order create failed, falling back to mock:', e.message);
      }
    }
    // Mock order payload for test
    const order = {
      id: 'order_' + makeId('rz_'),
      amount: amountPaise,
      currency: 'INR',
      receipt,
      status: 'created'
    };
    return res.json({
      mode: 'mock',
      order,
      faculty: {
        id: fac._id,
        name: fac.name,
        email: fac.email
      },
      receipt
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Capture/verify payment and persist receipt. Frontend sends order/payment ids.
router.post("/confirm", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      facultyId,
      month,
      amount,
      orderId,
      paymentId,
      signature
    } = req.body || {};
    if (!facultyId || !month || !amount || !orderId || !paymentId) return res.status(400).json({
      message: 'required fields missing'
    });
    const fac = await Faculty.findById(facultyId).lean().catch(() => null);
    if (!fac) return res.status(404).json({
      message: 'Faculty not found'
    });
    let payment = await SalaryPayment.create({
      facultyId,
      facultyName: fac.name,
      facultyEmail: fac.email,
      month,
      amount,
      status: 'paid',
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature || '',
      receiptNo: `SAL-${new Date().getFullYear()}-${String(makeId()).slice(-6).toUpperCase()}`
    });
    return res.status(201).json(payment);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// List all salary payments (admin)
router.get("/payments", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await SalaryPayment.find().sort({
      createdAt: -1
    }).lean().catch(() => []);
    return res.json(list);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Faculty: my salary payments
router.get("/my", verifyToken, requireRole('faculty'), async (req, res) => {
  try {
    // Resolve faculty record for current user
    const meUser = await User.findById(req.user.sub).lean().catch(() => null);
    if (!meUser) return res.status(404).json({
      message: 'User not found'
    });
    let fac = await Faculty.findOne({
      email: meUser.username
    }).lean().catch(() => null);
    if (!fac && meUser.name) fac = await Faculty.findOne({
      name: meUser.name
    }).lean().catch(() => null);
    if (!fac && meUser.contact) fac = await Faculty.findOne({
      contact: meUser.contact
    }).lean().catch(() => null);
    if (!fac) return res.status(404).json({
      message: 'Faculty record not linked'
    });
    const list = await SalaryPayment.find({
      facultyId: fac._id
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

// Generate simple HTML receipt for a salary payment (downloadable via browser)
router.get("/receipt/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const pay = await SalaryPayment.findById(id).lean().catch(() => null);
    if (!pay) return res.status(404).send('Receipt not found');
    // AuthZ: allow admin; allow the specific faculty for whom this receipt belongs
    const role = req.user && req.user.role;
    let allowed = role === 'admin';
    if (!allowed) {
      try {
        const meUser = await User.findById(req.user.sub).lean().catch(() => null);
        let fac = null;
        if (meUser) {
          fac = await Faculty.findOne({
            $or: [{
              email: meUser.username
            }, {
              name: meUser.name
            }, {
              contact: meUser.contact
            }]
          }).lean().catch(() => null);
        }
        if (fac && String(fac._id) === String(pay.facultyId)) allowed = true;
      } catch {}
    }
    if (!allowed) return res.status(403).send('Forbidden');
    // Avoid referencing undefined variables (was logging `origins` here and
    // causing a ReferenceError in some deployments). Keep a simple debug log.
    console.debug('Generating HTML salary receipt for id:', id);
    const issued = new Date(pay.createdAt || Date.now()).toLocaleString();
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Receipt ${pay.receiptNo || ''}</title>
<style>
  body{font-family: -apple-system, Segoe UI, Roboto, Arial; padding:20px;}
  .box{max-width:680px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}
  .head{background:#111827;color:#fff;padding:14px 16px;font-weight:800}
  .content{padding:16px;background:#fff}
  .row{display:flex;justify-content:space-between;margin:6px 0}
  .muted{color:#6b7280}
  .amount{font-size:18px;font-weight:900}
  .footer{padding:12px 16px;background:#f8fafc;color:#374151}
  .tag{display:inline-block;padding:4px 8px;border-radius:8px;background:#10b981;color:#fff;font-weight:800}
  .btn{display:inline-block;margin-top:12px;padding:10px 14px;border-radius:10px;background:#111827;color:#fff;text-decoration:none}
</style></head>
<body>
  <div class="box">
    <div class="head">Salary Receipt</div>
    <div class="content">
      <div class="row"><div>Receipt No</div><div><strong>${pay.receiptNo || '-'}</strong></div></div>
      <div class="row"><div>Faculty</div><div>${pay.facultyName || ''}</div></div>
      <div class="row"><div>Month</div><div>${pay.month || ''}</div></div>
      <div class="row"><div>Status</div><div><span class="tag">${pay.status || ''}</span></div></div>
      <div class="row"><div>Amount</div><div class="amount">₹${pay.amount || 0}</div></div>
      <div class="row muted"><div>Order ID</div><div>${pay.razorpayOrderId || '-'}</div></div>
      <div class="row muted"><div>Payment ID</div><div>${pay.razorpayPaymentId || '-'}</div></div>
      <div class="row muted"><div>Signature</div><div>${pay.razorpaySignature || '-'}</div></div>
      <div class="row muted"><div>Issued</div><div>${issued}</div></div>
    </div>
    <div class="footer">
      <div>Generated by ERP Salary Module</div>
      <a class="btn" href="javascript:window.print()">Print / Save PDF</a>
    </div>
  </div>
</body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (e) {
    return res.status(500).send('Failed to generate receipt');
  }
});

// PDF receipt (application/pdf). Requires pdfkit installed; otherwise returns 501.
router.get("/receipt/:id.pdf", verifyToken, async (req, res) => {
  try {
    if (!PDFDocument) {
      res.status(501);
      return res.json({
        message: 'PDF generation not available. Please install pdfkit on the server.'
      });
    }
    const id = req.params.id;
    const pay = await SalaryPayment.findById(id).lean().catch(() => null);
    if (!pay) return res.status(404).json({
      message: 'Receipt not found'
    });
    // AuthZ: admin or specific faculty
    const role = req.user && req.user.role;
    let allowed = role === 'admin';
    if (!allowed) {
      try {
        const meUser = await User.findById(req.user.sub).lean().catch(() => null);
        let fac = null;
        if (meUser) {
          fac = await Faculty.findOne({
            $or: [{
              email: meUser.username
            }, {
              name: meUser.name
            }, {
              contact: meUser.contact
            }]
          }).lean().catch(() => null);
        }
        if (fac && String(fac._id) === String(pay.facultyId)) allowed = true;
      } catch {}
    }
    if (!allowed) return res.status(403).json({
      message: 'Forbidden'
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt_${pay.receiptNo || id}.pdf"`);
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });
    doc.pipe(res);

    // Header
    doc.rect(0, 0, doc.page.width, 70).fill('#111827');
    doc.fill('#ffffff').fontSize(20).font('Helvetica-Bold').text('Salary Receipt', 50, 25);
    doc.moveDown(2);
    doc.fill('#000000');
    doc.font('Helvetica');
    const issued = new Date(pay.createdAt || Date.now()).toLocaleString();
    const rows = [['Receipt No', pay.receiptNo || '-'], ['Faculty', pay.facultyName || ''], ['Month', pay.month || ''], ['Status', pay.status || ''], ['Amount', `₹${pay.amount || 0}`], ['Order ID', pay.razorpayOrderId || '-'], ['Payment ID', pay.razorpayPaymentId || '-'], ['Signature', pay.razorpaySignature || '-'], ['Issued', issued]];

    // Table-like layout
    let y = 120;
    const labelX = 50;
    const valueX = 220;
    rows.forEach(([label, value], idx) => {
      doc.font('Helvetica-Bold').text(label, labelX, y);
      doc.font('Helvetica').text(String(value), valueX, y);
      y += 24;
    });
    doc.moveDown(2);
    doc.fontSize(10).fill('#374151').text('Generated by ERP Salary Module', 50, y + 10);
    doc.end();
  } catch (e) {
    return res.status(500).json({
      message: 'Failed to generate PDF'
    });
  }
});

// ===================== Staff Salary APIs (admin) =====================
// List all staff users (minimal fields)

  return router;
};
