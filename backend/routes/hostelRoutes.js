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

// Hostel Allocation APIs
// List allocations (optionally filter by studentId or hostelId)
router.get("/allocations", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      studentId,
      hostelId
    } = req.query || {};
    const filter = {};
    if (studentId) filter['student.id'] = studentId;
    if (hostelId) filter.hostelId = hostelId;
    const list = await prisma.hostelAllocation.findMany({
      where: filter,

      orderBy: {
        createdAt: "desc"
      }
    }).catch(() => []);
    // Attach latest receipt info (if any) to each allocation for admin convenience
    try {
      const allocIds = list.map(l => (l.id || l._id)).filter(Boolean);
      if (allocIds.length > 0) {
        const recs = await prisma.receipt.findMany({
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
          const k = String((l.id || l._id));
          if (map[k]) {
            l.receiptId = map[k]._id;
            l.receiptPdfUrl = map[k].pdfUrl || '';
          }
        }
      }
    } catch (e) {
      console.warn('Failed to attach hostel receipts to allocations', e && e.message);
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
    const required = ['when', 'hostelId', 'floorNo', 'roomNo', 'bedIndex', 'student', 'bedType', 'fee'];
    for (const k of required) {
      if (payload[k] === undefined || payload[k] === null) return res.status(400).json({
        message: `${k} required`
      });
    }
    const doc = await prisma.hostelAllocation.create({ data: payload });

    // Map parts to academic terms for clarity
    function mapPartToTerm(idx) {
      const terms = ['Term I', 'Term II', 'Term III'];
      return terms[idx - 1] || `Term ${idx}`;
    }

    // If option is add-to-fee, append fee parts to student's assignedFees; if pay-now, create a receipt stub
    try {
      if (payload.fee && payload.student && payload.student.id) {
        const parts = Number(payload.fee.parts || 1);
        const per = Number(payload.fee.perPart || payload.fee.amount || 0);
        const note = `Hostel ${payload.hostelId} Floor ${payload.floorNo} Room ${payload.roomNo} Bed ${Number(payload.bedIndex) + 1} (${payload.bedType})`;
        if (String(payload.fee.option) === 'add-to-fee') {
          const termEntries = [];
          for (let i = 1; i <= Math.max(1, parts); i++) {
            termEntries.push({
              term: mapPartToTerm(i),
              amount: per,
              note,
              by: req.user && req.user.sub
            });
          }
          await prisma.student.update({
            where: {
              id: String(payload.student.id)
            },

            data: {
              push: {
                assignedFees: {
                  $each: termEntries
                }
              }
            }
          }).catch(() => null);
        } else if (String(payload.fee.option) === 'pay-now') {
          await Receipt.create({
            data: {
              studentId: payload.student.id,
              studentName: payload.student.name,
              studentEmail: payload.student.email || '',
              class: payload.student.class || '',
              term: 'Hostel (Pay Now)',
              amount: Number(payload.fee.amount || per * parts) || 0
            }
          }).catch(() => null);
        }
      }
    } catch (e) {
      console.warn('Failed to append hostel fee parts to student assignedFees', e && e.message);
    }
    return res.status(201).json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Mark an allocation as paid (creates a receipt)
router.post("/allocations/:id/mark-paid", verifyToken, async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const alloc = await prisma.hostelAllocation.findUnique({
      where: {
        id: String(id)
      }
    }).catch(() => null);
    if (!alloc) return res.status(404).json({
      message: 'Allocation not found'
    });
    // Only student who owns it or admin can mark paid
    const isOwner = req.user && alloc.student && String(alloc.student.id) === String(req.user.sub);
    const isAdmin = req.user && req.user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({
      message: 'Forbidden'
    });
    // create receipt document
    const receiptDoc = await ReceiptModel.create({
      data: {
        studentId: alloc.student.id,
        allocationId: (alloc.id || alloc._id),
        studentName: alloc.student.name,
        studentEmail: alloc.student.email || '',
        class: alloc.student.class || '',
        term: 'Hostel Payment',
        amount: Number(alloc.fee.amount || 0) || 0
      }
    });
    // try to fill rollNo from Student document
    try {
      let sdoc = null;
      if (alloc && alloc.student && alloc.student.id) {
        try {
          sdoc = await prisma.student.findUnique({
            where: {
              id: String(alloc.student.id)
            }
          }).catch(() => null);
        } catch (e) {
          sdoc = null;
        }
      }
      if (!sdoc && receiptDoc.studentEmail) {
        try {
          sdoc = await prisma.student.findFirst({
            where: {
              email: receiptDoc.studentEmail
            }
          }).catch(() => null);
        } catch (e) {
          sdoc = null;
        }
      }
      if (sdoc) {
        if (!receiptDoc.rollNo && sdoc.rollNo) receiptDoc.rollNo = sdoc.rollNo;
        await prisma.receipt.update({ where: { id: receiptDoc.id }, data: { status: receiptDoc.status, pdfUrl: receiptDoc.pdfUrl, pdfPath: receiptDoc.pdfPath } }).catch(() => null);
      }
    } catch (e) {
      console.warn('Failed to enrich hostel receipt with student roll/class', e && e.message);
    }
    // try generate PDF and attach
    try {
      const gen = await generateReceiptPdf(receiptDoc.toObject ? receiptDoc : receiptDoc, alloc.toObject ? alloc : alloc);
      if (gen) {
        receiptDoc.pdfPath = gen.pdfPath;
        receiptDoc.pdfUrl = gen.pdfUrl;
        await prisma.receipt.update({ where: { id: receiptDoc.id }, data: { status: receiptDoc.status, pdfUrl: receiptDoc.pdfUrl, pdfPath: receiptDoc.pdfPath } }).catch(() => null);
      }
    } catch (e) {
      console.warn('pdf gen failed on mark-paid', e && e.message);
    }

    // update allocation: add payment record and mark paid
    try {
      const p = {
        partIndex: 0,
        amount: Number(receiptDoc.amount || 0),
        orderId: '',
        paymentId: '',
        receiptId: String((receiptDoc.id || receiptDoc._id)),
        status: 'paid'
      };
      alloc.payments = alloc.payments || [];
      alloc.payments.push(p);
      alloc.paid = true;
      // Transpiled save()
    if (alloc) {
      const { id: _unused_id, _id: _unused__id, save: _unused_save, toObject: _unused_toObject, ..._updateData } = alloc;
      
      // Clean out relational arrays if any to prevent Prisma crash
      for (const k in _updateData) {
        if (Array.isArray(_updateData[k]) && _updateData[k].length > 0 && typeof _updateData[k][0] === 'object') {
           delete _updateData[k];
        }
      }

      await prisma.hostelAllocation.update({
        where: { id: String((alloc.id || alloc._id)) },
        data: _updateData
      }).catch(e => console.error("Transpiled save error:", e.message));
    }
    } catch (e) {
      console.warn('Failed to update allocation with receipt', e && e.message);
    }
    const updated = await prisma.hostelAllocation.findUnique({
      where: {
        id: String(id)
      }
    }).catch(() => null);
    return res.json(updated);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Receipts: list my receipts

// Hostel receipts: list my hostel receipts (separate from generic receipts list)
router.get("/receipts/my", verifyToken, async (req, res) => {
  try {
    const userId = req.user && req.user.sub;
    if (!userId) return res.status(401).json({
      message: 'Not authenticated'
    });

    // Resolve Student document (allocations embed student.id as (Student.id || Student._id)). Fall back to matching by user email.
    let studentDoc = null;
    try {
      studentDoc = await prisma.student.findUnique({
        where: {
          id: String(userId)
        }
      }).catch(() => null);
    } catch (e) {
      studentDoc = null;
    }

    // Find allocations for this student using the resolved student id or user email
    let allocs = [];
    try {
      if (studentDoc && (studentDoc.id || studentDoc._id)) {
        allocs = await prisma.hostelAllocation.findMany({
          where: {
            'student.id': (studentDoc.id || studentDoc._id)
          }
        }).catch(() => []);
      } else {
        // try matching by user.username (email) stored in embedded allocation student.email
        let u = null;
        try {
          u = await prisma.user.findUnique({
            where: {
              id: String(userId)
            }
          }).catch(() => null);
        } catch (e) {
          u = null;
        }
        if (u && u.username) {
          allocs = await prisma.hostelAllocation.findMany({
            where: {
              'student.email': u.username
            }
          }).catch(() => []);
        }
      }
    } catch (e) {
      allocs = [];
    }
    const allocIds = allocs.map(a => (a.id || a._id)).filter(Boolean);

    // Build list of possible studentId values that may appear on receipts (some code uses (User.id || User._id), some uses (Student.id || Student._id))
    const studentIds = [String(userId)];
    if (studentDoc && (studentDoc.id || studentDoc._id) && String((studentDoc.id || studentDoc._id)) !== String(userId)) studentIds.push(String((studentDoc.id || studentDoc._id)));

    // Query receipts that belong to this student (by id) or are tied to one of the student's hostel allocations
    const filter = allocIds.length > 0 ? {
      OR: [{
        studentId: {
          in: studentIds
        }
      }, {
        allocationId: {
          in: allocIds
        }
      }]
    } : {
      studentId: {
        in: studentIds
      }
    };
    const list = await prisma.receipt.findMany({
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

// Admin: backfill/complete missing hostel receipts (populate rollNo/class/pdfUrl where possible)
router.post("/receipts/backfill", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    // Find receipts that are likely incomplete: missing rollNo or missing pdfUrl
    const candidates = await prisma.receiptModel.findMany({
      where: {
        OR: [{ status: 'paid' }, { status: 'Success' }],
        AND: {
          OR: [
            { rollNo: null },
            { rollNo: '' },
            { pdfUrl: null },
            { pdfUrl: '' }
          ]
        }
      },
      take: 500
    }).catch(() => []);
    const results = [];
    for (const r of candidates) {
      try {
        let updated = false;
        let doc = await prisma.receiptModel.findUnique({
          where: {
            id: String((r.id || r._id))
          }
        }).catch(() => null);
        if (!doc) continue;
        // attempt to fill student info
        let sdoc = null;
        if (doc.studentId) {
          try {
            sdoc = await prisma.student.findUnique({
              where: {
                id: String(doc.studentId)
              }
            }).catch(() => null);
          } catch (e) {
            sdoc = null;
          }
        }
        if (!sdoc && doc.studentEmail) {
          try {
            sdoc = await prisma.student.findFirst({
              where: {
                email: doc.studentEmail
              }
            }).catch(() => null);
          } catch (e) {
            sdoc = null;
          }
        }
        if (sdoc) {
          if ((!doc.rollNo || doc.rollNo === '') && sdoc.rollNo) {
            doc.rollNo = sdoc.rollNo;
            updated = true;
          }
          if ((!doc.class || doc.class === '') && (sdoc.class || sdoc.studentClass)) {
            doc.class = sdoc.class || sdoc.studentClass;
            updated = true;
          }
          if ((!doc.studentName || doc.studentName === '') && sdoc.name) {
            doc.studentName = sdoc.name;
            updated = true;
          }
        }
        // attempt to attach allocation info and generate pdf if missing
        let alloc = null;
        if (doc.allocationId) {
          try {
            alloc = await prisma.hostelAllocation.findUnique({
              where: {
                id: String(doc.allocationId)
              }
            }).catch(() => null);
          } catch (e) {
            alloc = null;
          }
        }
        if ((!doc.pdfUrl || doc.pdfUrl === '') && (doc.id || doc._id)) {
          try {
            const gen = await generateReceiptPdf(doc.toObject ? doc : doc, alloc && alloc.toObject ? alloc : alloc);
            if (gen) {
              doc.pdfPath = gen.pdfPath;
              doc.pdfUrl = gen.pdfUrl;
              updated = true;
            }
          } catch (e) {
            console.warn('pdf gen backfill failed for', String((doc.id || doc._id)), e && e.message);
          }
        }
        if (updated) await prisma.contactQuery.update({ where: { id: doc.id }, data: { notified: doc.notified, status: doc.status } }).catch(() => null);
        results.push({
          id: String((r.id || r._id)),
          updated
        });
      } catch (e) {
        console.warn('backfill item failed', e && e.message);
      }
    }
    return res.json({
      ok: true,
      processed: results.length,
      results
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Delete all allocations (admin-only)
router.delete("/allocations", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    await prisma.hostelAllocation.deleteMany();
    return res.json({
      ok: true
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Hostel CRUD APIs
// List all hostels

// Student: view my hostel allocations
router.get("/allocations/my", verifyToken, async (req, res) => {
  try {
    const userId = req.user && req.user.sub;
    if (!userId) return res.status(401).json({
      message: 'Not authenticated'
    });
    let filter = {};
    // Try to resolve a Student document for this authenticated user
    let studentDoc = null;
    try {
      studentDoc = await prisma.student.findUnique({
        where: {
          id: String(userId)
        }
      }).catch(() => null);
    } catch {}
    if (studentDoc && (studentDoc.id || studentDoc._id)) {
      filter['student.id'] = (studentDoc.id || studentDoc._id);
    } else {
      // Fallback: match by email/username in embedded allocation data
      let u = null;
      try {
        u = await prisma.user.findUnique({
          where: {
            id: String(userId)
          }
        }).catch(() => null);
      } catch {}
      if (u && u.username) {
        filter['student.email'] = u.username;
      } else {
        // As a last resort, return no allocations rather than leaking data
        filter['student.id'] = userId;
      }
    }
    const list = await prisma.hostelAllocation.findMany({
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

// Public: minimal hostel list (no auth) for student display

  return router;
};
