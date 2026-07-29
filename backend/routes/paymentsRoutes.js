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

// Create Razorpay order (or stub if razorpayClient not configured)

// Confirm payment: accepts razorpay ids, creates Receipt, generates PDF and updates allocation/payments

// Return current authenticated student's document
// This handler tries multiple strategies to resolve the student document:
// 1) If `req.user.sub` matches a Student _id, return that
// 2) Otherwise, try to resolve by `req.user.username` (email)
// 3) If still not found, return 404
router.post("/order", verifyToken, async (req, res) => {
  try {
    const {
      amount,
      receipt
    } = req.body || {};
    if (!amount) return res.status(400).json({
      message: 'amount required'
    });
    const amt = Math.round(Number(amount) * 100); // rupees -> paise
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({
      message: 'valid amount required'
    });
    const receiptId = String(receipt || `rcpt_${Date.now()}`).slice(0, 40);
    if (razorpayClient) {
      const ord = await razorpayClient.orders.create({
        amount: amt,
        currency: 'INR',
        receipt: receiptId
      });
      // attach key id so frontend can initialize checkout with correct key
      try {
        ord.keyId = process.env.RAZORPAY_KEY_ID || '';
      } catch (e) {}
      return res.json(ord);
    }
    // stub order (no key available)
    return res.json({
      id: `stub_${Date.now()}`,
      amount: amt,
      currency: 'INR',
      receipt: receiptId,
      keyId: process.env.RAZORPAY_KEY_ID || ''
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message || 'Failed to create order'
    });
  }
});
router.post("/confirm", verifyToken, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      allocationId,
      studentId,
      studentName,
      studentEmail,
      class: studentClass,
      term,
      amount
    } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id) return res.status(400).json({
      message: 'order_id and payment_id required'
    });
    if (process.env.RAZORPAY_KEY_SECRET) {
      if (!razorpay_signature) return res.status(400).json({
        message: 'payment signature required'
      });
      const crypto = require('crypto');
      const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
      if (expectedSignature !== razorpay_signature) return res.status(400).json({
        message: 'Invalid payment signature'
      });
    }
    if (studentId) {
      const role = req.user && req.user.role;
      if (role === 'parent') {
        const parent = await prisma.user.findUnique({ where: { id: String(req.user.sub) } }).catch(() => null);
        const linked = parent && Array.isArray(parent.parentOf) && parent.parentOf.some(x => String(x) === String(studentId));
        if (!linked) return res.status(403).json({
          message: 'Parent is not linked to this student'
        });
      } else if (role === 'student') {
        const currentStudent = await Student.findOne({
          email: req.user && req.user.username
        }).catch(() => null);
        if (!currentStudent || String(currentStudent._id) !== String(studentId)) return res.status(403).json({
          message: 'Cannot pay for another student'
        });
      }
    }
    const ReceiptModel = require('./models/Receipt');
    const alloc = allocationId ? await prisma.hostelallocation.findUnique({ where: { id: String(allocationId) } }).catch(() => null) : null;
    const receipt = await ReceiptModel.create({
      studentId: studentId || alloc && alloc.student && alloc.student.id || null,
      allocationId: allocationId || alloc && alloc._id || null,
      studentName: studentName || alloc && alloc.student && alloc.student.name || '',
      studentEmail: studentEmail || alloc && alloc.student && alloc.student.email || '',
      class: studentClass || alloc && alloc.student && alloc.student.class || '',
      term: term || '',
      amount: Number(amount || 0) || 0,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature || ''
    });
    // try to populate rollNo and normalize student info from Student document when possible
    try {
      const sid = receipt.studentId || receipt.studentId === 0 ? receipt.studentId : null;
      let sdoc = null;
      if (sid) {
        try {
          sdoc = await prisma.student.findUnique({ where: { id: String(sid) } }).catch(() => null);
        } catch (e) {
          sdoc = null;
        }
      }
      if (!sdoc && receipt.studentEmail) {
        try {
          sdoc = await Student.findOne({
            email: receipt.studentEmail
          }).catch(() => null);
        } catch (e) {
          sdoc = null;
        }
      }
      if (sdoc) {
        if (!receipt.rollNo && sdoc.rollNo) receipt.rollNo = sdoc.rollNo;
        if ((!receipt.class || receipt.class === '') && (sdoc.class || sdoc.studentClass)) receipt.class = sdoc.class || sdoc.studentClass || '';
        if (!receipt.studentName && sdoc.name) receipt.studentName = sdoc.name;
        await receipt.save().catch(() => null);
      }
    } catch (e) {
      console.warn('Failed to enrich receipt with student info', e && e.message);
    }

    // generate PDF
    try {
      const gen = await generateReceiptPdf(receipt.toObject ? receipt.toObject() : receipt, alloc && alloc.toObject ? alloc.toObject() : alloc);
      if (gen) {
        receipt.pdfPath = gen.pdfPath;
        receipt.pdfUrl = gen.pdfUrl;
        await receipt.save().catch(() => null);
      }
    } catch (e) {
      console.warn('pdf gen failed on confirm', e && e.message);
    }

    // update allocation payments: mark specific term/part as paid
    try {
      if (alloc) {
        const payments = alloc.payments || [];
        // derive partIndex from term like 'Term 1' or 'Term I'
        let partIndex = null;
        const m = String(term || '').match(/(\d+)/);
        if (m) partIndex = Number(m[0]);
        const p = {
          partIndex: partIndex || 0,
          amount: Number(receipt.amount || 0),
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          receiptId: String(receipt._id),
          status: 'paid'
        };
        payments.push(p);
        alloc.payments = payments;
        // if parts count equals payments with status paid, mark alloc.paid true
        try {
          const parts = alloc.fee && Number(alloc.fee.parts || 1);
          const paidCount = (payments || []).filter(x => x.status === 'paid').length;
          if (parts && paidCount >= parts) alloc.paid = true;
        } catch (e) {}
        await alloc.save();
      }
    } catch (e) {
      console.warn('Failed to update allocation payments on confirm', e && e.message);
    }
    return res.json({
      ok: true,
      receipt
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

  return router;
};
