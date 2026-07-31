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

// ===================== Staff Salary APIs (admin) =====================
// List all staff users (minimal fields)
router.get("/staff", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await prisma.user.findMany({
      where: {
        role: 'staff'
      }
    }).catch(() => []);
    return res.json(list);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Create a staff salary payment (mock Razorpay flow)
router.post("/pay", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      userId,
      month,
      amount
    } = req.body || {};
    if (!userId || !month || !amount) return res.status(400).json({
      message: 'userId, month, amount required'
    });
    const staff = await prisma.user.findUnique({
      where: {
        id: String(userId)
      }
    }).catch(() => null);
    if (!staff || staff.role !== 'staff') return res.status(404).json({
      message: 'Staff not found'
    });
    let payment = await StaffSalaryPayment.create({
      data: {
        userId,
        staffName: staff.name || staff.username,
        staffEmail: staff.username || '',
        month,
        amount,
        status: 'pending'
      }
    });
    const razorpayOrderId = 'order_' + makeId('rz_');
    const razorpayPaymentId = 'pay_' + makeId('rz_');
    const razorpaySignature = makeId('sig_');
    const receiptNo = `SSL-${new Date().getFullYear()}-${String(((payment.id || payment._id))).slice(-6).toUpperCase()}`;
    payment.razorpayOrderId = razorpayOrderId;
    payment.razorpayPaymentId = razorpayPaymentId;
    payment.razorpaySignature = razorpaySignature;
    payment.receiptNo = receiptNo;
    payment.status = 'paid';
    if(payment.id) { await prisma.staffSalaryPayment.update({ where: { id: payment.id }, data: payment }).catch(() => null); }
    return res.status(201).json(payment);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Generate a pending staff salary slip for tracking before payment
router.post("/slips", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      userId,
      month,
      basic = 0,
      allowances = 0,
      deductions = 0,
      amount,
      notes = ''
    } = req.body || {};
    if (!userId || !month) return res.status(400).json({
      message: 'userId and month required'
    });
    const staff = await prisma.user.findUnique({
      where: {
        id: String(userId)
      }
    }).catch(() => null);
    if (!staff || staff.role !== 'staff') return res.status(404).json({
      message: 'Staff not found'
    });
    const basicNum = Number(basic || 0);
    const allowancesNum = Number(allowances || 0);
    const deductionsNum = Number(deductions || 0);
    const totalAmount = amount !== undefined && amount !== '' ? Number(amount || 0) : Math.max(0, basicNum + allowancesNum - deductionsNum);
    if (!totalAmount || totalAmount < 0) return res.status(400).json({
      message: 'Valid salary amount required'
    });
    const slip = await StaffSalaryPayment.create({
      data: {
        userId,
        staffName: staff.name || staff.username,
        staffEmail: staff.username || '',
        month: String(month),
        basic: basicNum,
        allowances: allowancesNum,
        deductions: deductionsNum,
        amount: totalAmount,
        notes: String(notes || ''),
        status: 'pending',
        receiptNo: `SSL-${new Date().getFullYear()}-${String(makeId()).slice(-6).toUpperCase()}`
      }
    });
    return res.status(201).json(slip);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Mark an existing staff salary slip as paid
router.patch("/payments/:id/mark-paid", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const id = req.params.id;
    const {
      paymentMethod = 'Cash',
      paymentDate,
      notes
    } = req.body || {};
    const pay = await prisma.staffSalaryPayment.findUnique({
      where: {
        id: String(id)
      }
    }).catch(() => null);
    if (!pay) return res.status(404).json({
      message: 'Salary slip not found'
    });
    pay.status = 'paid';
    pay.paymentMethod = String(paymentMethod || 'Cash');
    pay.paymentDate = paymentDate ? new Date(paymentDate) : new Date();
    if (notes !== undefined) pay.notes = String(notes || '');
    if (!pay.receiptNo) pay.receiptNo = `SSL-${new Date().getFullYear()}-${String(((pay.id || pay._id))).slice(-6).toUpperCase()}`;
    if (!pay.razorpayPaymentId) pay.razorpayPaymentId = `manual_${makeId('pay_')}`;
    // Transpiled save()
    if (pay) {
      const { id: _unused_id, _id: _unused__id, save: _unused_save, toObject: _unused_toObject, ..._updateData } = pay;
      
      // Clean out relational arrays if any to prevent Prisma crash
      for (const k in _updateData) {
        if (Array.isArray(_updateData[k]) && _updateData[k].length > 0 && typeof _updateData[k][0] === 'object') {
           delete _updateData[k];
        }
      }

      await prisma.staffSalaryPayment.update({
        where: { id: String(((pay.id || pay._id))) },
        data: _updateData
      }).catch(e => console.error("Transpiled save error:", e.message));
    }
    return res.json(pay);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Create Razorpay order for staff salary
router.post("/order", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      userId,
      month,
      amount
    } = req.body || {};
    if (!userId || !month || !amount) return res.status(400).json({
      message: 'userId, month, amount required'
    });
    const staff = await prisma.user.findUnique({
      where: {
        id: String(userId)
      }
    }).catch(() => null);
    if (!staff || staff.role !== 'staff') return res.status(404).json({
      message: 'Staff not found'
    });
    const amountPaise = Math.round(Number(amount) * 100);
    const receipt = `SSL-${new Date().getFullYear()}-${makeId('r_')}`;
    if (razorpayClient) {
      try {
        const order = await razorpayClient.orders.create({
          amount: amountPaise,
          currency: 'INR',
          receipt,
          notes: {
            userId: String(((staff.id || staff._id))),
            month
          }
        });
        return res.json({
          mode: 'razorpay',
          order,
          staff: {
            id: ((staff.id || staff._id)),
            name: staff.name || staff.username,
            email: staff.username || ''
          },
          receipt
        });
      } catch (e) {
        console.warn('Razorpay order create failed (staff), falling back to mock:', e.message);
      }
    }
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
      staff: {
        id: ((staff.id || staff._id)),
        name: staff.name || staff.username,
        email: staff.username || ''
      },
      receipt
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Confirm staff salary payment and persist receipt
router.post("/confirm", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      userId,
      month,
      amount,
      orderId,
      paymentId,
      signature
    } = req.body || {};
    if (!userId || !month || !amount || !orderId || !paymentId) return res.status(400).json({
      message: 'required fields missing'
    });
    const staff = await prisma.user.findUnique({
      where: {
        id: String(userId)
      }
    }).catch(() => null);
    if (!staff || staff.role !== 'staff') return res.status(404).json({
      message: 'Staff not found'
    });
    let payment = await StaffSalaryPayment.create({
      data: {
        userId,
        staffName: staff.name || staff.username,
        staffEmail: staff.username || '',
        month,
        amount,
        status: 'paid',
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: signature || '',
        receiptNo: `SSL-${new Date().getFullYear()}-${String(makeId()).slice(-6).toUpperCase()}`
      }
    });
    return res.status(201).json(payment);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// List all staff salary payments
router.get("/payments", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await prisma.staffSalaryPayment.findMany({
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

// Staff: my staff salary payments
router.get("/my-payments", verifyToken, requireRole('staff'), async (req, res) => {
  try {
    const userId = String(req.user && req.user.sub);
    const list = await prisma.staffSalaryPayment.findMany({
      where: {
        userId
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

// Generate HTML receipt for staff salary payment (admin or owning staff)
router.get("/receipt/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const pay = await prisma.staffSalaryPayment.findUnique({
      where: {
        id: String(id)
      }
    }).catch(() => null);
    if (!pay) return res.status(404).send('Receipt not found');
    const isAdmin = req.user && req.user.role === 'admin';
    const isOwner = req.user && String(req.user.sub) === String(pay.userId);
    if (!isAdmin && !isOwner) return res.status(403).send('Forbidden');
    const uid = (pay.userId || '').toString();
    const staffIdDisplay = uid ? `STF-${uid.slice(-6).toUpperCase()}` : '-';
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
    <div class="head">Staff Salary Receipt</div>
    <div class="content">
      <div class="row"><div>Receipt No</div><div><strong>${pay.receiptNo || '-'}</strong></div></div>
      <div class="row"><div>Staff</div><div>${pay.staffName || ''}</div></div>
      <div class="row"><div>Staff ID</div><div>${staffIdDisplay}</div></div>
      <div class="row"><div>Month</div><div>${pay.month || ''}</div></div>
      <div class="row"><div>Status</div><div><span class="tag">${pay.status || ''}</span></div></div>
      <div class="row"><div>Amount</div><div class="amount">₹${pay.amount || 0}</div></div>
      <div class="row muted"><div>Order ID</div><div>${pay.razorpayOrderId || '-'}</div></div>
      <div class="row muted"><div>Payment ID</div><div>${pay.razorpayPaymentId || '-'}</div></div>
      <div class="row muted"><div>Signature</div><div>${pay.razorpaySignature || '-'}</div></div>
      <div class="row muted"><div>Issued</div><div>${issued}</div></div>
    </div>
    <div class="footer">
      <div>Generated by ERP Staff Salary Module</div>
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

// Staff/Admin: PDF receipt for staff salary payment
router.get("/receipt/:id.pdf", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const pay = await prisma.staffSalaryPayment.findUnique({
      where: {
        id: String(id)
      }
    }).catch(() => null);
    if (!pay) return res.status(404).json({
      message: 'Receipt not found'
    });
    const isAdmin = req.user && req.user.role === 'admin';
    const isOwner = req.user && String(req.user.sub) === String(pay.userId);
    if (!isAdmin && !isOwner) return res.status(403).json({
      message: 'Forbidden'
    });
    let PDFDocument;
    try {
      PDFDocument = require('pdfkit');
    } catch {
      return res.status(501).json({
        message: 'PDF generation not available'
      });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="staff_receipt_${pay.receiptNo || id}.pdf"`);
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40
    });
    doc.pipe(res);

    // header
    doc.rect(40, 20, 515, 40).fill('#111827');
    doc.fill('#ffffff').fontSize(20).font('Helvetica-Bold').text('Staff Salary Receipt', 50, 25);
    doc.fill('#111827');
    const issued = new Date(pay.createdAt || Date.now()).toLocaleString();
    const uid = (pay.userId || '').toString();
    const staffIdDisplay = uid ? `STF-${uid.slice(-6).toUpperCase()}` : '-';
    const rows = [['Receipt No', pay.receiptNo || '-'], ['Staff', pay.staffName || '-'], ['Staff ID', staffIdDisplay], ['Month', pay.month || '-'], ['Status', pay.status || '-'], ['Amount', `₹${pay.amount || 0}`], ['Order ID', pay.razorpayOrderId || '-'], ['Payment ID', pay.razorpayPaymentId || '-'], ['Signature', pay.razorpaySignature || '-'], ['Issued', issued]];
    let y = 80;
    const labelX = 50,
      valueX = 220;
    doc.fontSize(12);
    rows.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').text(String(label), labelX, y);
      doc.font('Helvetica').text(String(value), valueX, y);
      y += 24;
    });
    doc.moveDown(2);
    doc.fontSize(10).fill('#374151').text('Generated by ERP Staff Salary Module', 50, y + 10);
    doc.end();
  } catch (e) {
    return res.status(500).json({
      message: 'Failed to generate PDF'
    });
  }
});

// Faculty registration endpoint (public) - stores registration for admin approval

  return router;
};
