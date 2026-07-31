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

// ===================== Transport Allocation APIs =====================
// List allocations (optionally filter by studentId or routeId)
router.get("/allocations", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      studentId,
      routeId
    } = req.query || {};
    const filter = {};
    if (studentId) filter['student.id'] = studentId;
    if (routeId) filter.routeId = routeId;
    const list = await prisma.transportAllocation.findMany({
      where: filter,

      orderBy: {
        createdAt: "desc"
      }
    }).catch(() => []);
    // Attach latest receipt info (if any) to each allocation for admin convenience
    try {
      const allocIds = list.map(l => ((l.id || l._id))).filter(Boolean);
      if (allocIds.length > 0) {
        const recs = await prisma.transportReceipt.findMany({
          where: {
            allocationId: {
              in: allocIds
            }
          },

          orderBy: {
            createdAt: "desc"
          }
        }).catch(() => []);
        const map = {};
        for (const r of recs) {
          const key = String(r.allocationId || r.allocationId);
          if (!map[key]) map[key] = r;
        }
        for (const l of list) {
          const k = String(((l.id || l._id)));
          if (map[k]) {
            l.receiptId = map[k]._id;
            l.receiptPdfUrl = map[k].pdfUrl || '';
          }
        }
      }
    } catch (e) {
      console.warn('Failed to attach transport receipts to allocations', e && e.message);
    }
    return res.json(list);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Create allocation
router.post("/allocations", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const payload = req.body || {};
    const required = ['when', 'routeId', 'stopId', 'busId', 'seatNo', 'student', 'fee'];
    for (const k of required) {
      if (payload[k] === undefined || payload[k] === null) return res.status(400).json({
        message: `${k} required`
      });
    }
    const doc = await prisma.transportAllocation.create({ data: payload });
    // Optionally, add fee to student's assignedFees or create a receipt stub
    try {
      if (payload.fee && payload.student && payload.student.id) {
        const note = `Transport Route ${payload.routeId} Stop ${payload.stopId} Bus ${payload.busId} Seat ${payload.seatNo}`;
        if (String(payload.fee.option) === 'add-to-fee') {
          const entry = {
            term: 'Transport',
            amount: Number(payload.fee.amount || 0),
            note,
            by: req.user && req.user.sub
          };
          await prisma.student.update({
            where: {
              id: String(payload.student.id)
            },

            data: {
              push: {
                assignedFees: entry
              }
            }
          }).catch(() => null);
        } else if (String(payload.fee.option) === 'pay-now') {
          try {
            // create a transport receipt record (minimal fields)
            const alloc = doc;
            const amount = Number(payload.fee.amount || 0);
            const bodyRouteName = payload.routeName || '';
            const bodyStopName = payload.stopId || '';
            const bodyBusName = payload.busId || '';
            const razorpay_order_id = payload.razorpayOrderId || payload.razorpay_order_id || null;
            const razorpay_payment_id = payload.razorpayPaymentId || payload.razorpay_payment_id || null;
            const razorpay_signature = payload.razorpaySignature || payload.razorpay_signature || null;
            const receipt = await TransportReceipt.create({
              data: {
                allocationId: alloc ? ((alloc.id || alloc._id)) : null,
                studentId: payload.student && payload.student.id ? payload.student.id : null,
                busId: alloc ? alloc.busId : '',
                routeName: bodyRouteName || (alloc ? alloc.routeName || '' : ''),
                stopName: bodyStopName || (alloc ? alloc.stopName || '' : ''),
                busName: bodyBusName || (alloc ? alloc.busName || '' : ''),
                seatNo: alloc ? alloc.seatNo : '',
                amount: Number(amount || 0) || 0,
                razorpayOrderId: razorpay_order_id,
                razorpayPaymentId: razorpay_payment_id,
                razorpaySignature: razorpay_signature || ''
              }
            });
            console.log('Created transport receipt', receipt && ((receipt.id || receipt._id)));

            // generate PDF
            try {
              const gen = await generateReceiptPdf(receipt.toObject ? receipt : receipt, alloc && alloc.toObject ? alloc : alloc, 'transport');
              if (gen) {
                receipt.pdfPath = gen.pdfPath;
                receipt.pdfUrl = gen.pdfUrl;
                await prisma.receipt.update({ where: { id: receipt.id }, data: { status: receipt.status, pdfUrl: receipt.pdfUrl, pdfPath: receipt.pdfPath } }).catch(() => null);
              }
            } catch (e) {
              console.warn('pdf gen failed on transport confirm', e && e.message);
            }

            // update allocation payments
            try {
              if (alloc) {
                const payments = alloc.payments || [];
                const p = {
                  amount: Number(receipt.amount || 0),
                  orderId: razorpay_order_id,
                  paymentId: razorpay_payment_id,
                  receiptId: String(((receipt.id || receipt._id))),
                  status: 'paid'
                };
                payments.push(p);
                alloc.payments = payments;
                alloc.paid = true;
                await prisma.hostelAllocation.update({ where: { id: alloc.id }, data: { /* specify fields if needed */ } });
                console.log('Updated allocation as paid', ((alloc.id || alloc._id)));
              }
            } catch (e) {
              console.warn('Failed to update transport allocation payments on confirm', e && e.message);
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
        }
      }
    } catch (e) {
      console.warn('Failed handling transport fee processing', e && e.message);
    }

    // if not returned earlier (e.g. no immediate pay-now flow), respond with created allocation
    return res.json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Student: list their allocations
router.get("/allocations/my", verifyToken, async (req, res) => {
  try {
    const userId = req.user && req.user.sub;
    const username = req.user && req.user.username;
    const filter = {};
    if (userId) filter['student.id'] = userId;else if (username) filter['student.email'] = username;
    const list = await prisma.transportAllocation.findMany({
      where: filter,

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

// Student: get their transport receipts
router.get("/receipts/my", verifyToken, async (req, res) => {
  try {
    const username = req.user && req.user.username;
    const filter = {};
    if (username) filter.studentEmail = username;
    const items = await prisma.transportReceipt.findMany({
      where: filter,

      orderBy: {
        createdAt: "desc"
      }
    }).catch(() => []);
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

  return router;
};
