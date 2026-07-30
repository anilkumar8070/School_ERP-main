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

// Admin: list parents
router.get("/", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const q = (req.query.q || '').trim();
    const base = {
      role: 'parent'
    };
    let filter = base;
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'i');
      filter = {
        $and: [base, {
          OR: [{
            name: re
          }, {
            username: re
          }, {
            contact: re
          }, {
            address: re
          }]
        }]
      };
    }
    let parents = await prisma.user.findMany({
      where: filter,

      orderBy: {
        createdAt: "desc"
      },

      select: {
        name: true,
        username: true,
        disabled: true,
        contact: true,
        address: true,
        createdAt: true,
        parentOf: true,
        avatar: true
      }
    });

    // Resolve parentOf entries to student names when they appear to be student IDs
    try {
      // Collect candidate ids across parents
      const idCandidates = new Set();
      parents.forEach(p => {
        if (Array.isArray(p.parentOf)) {
          p.parentOf.forEach(item => {
            if (typeof item === 'string' && /^[0-9a-fA-F]{24}$/.test(item)) idCandidates.add(item);
          });
        }
      });
      if (idCandidates.size > 0) {
        const ids = Array.from(idCandidates);
        const students = await prisma.student.findMany({
          where: {
            _id: {
              in: ids
            }
          },

          select: {
            name: true,
            id: true
          }
        });
        const idToName = {};
        students.forEach(s => {
          idToName[String(s._id)] = s.name;
        });
        parents = parents.map(p => {
          if (!Array.isArray(p.parentOf) || p.parentOf.length === 0) return p;
          const resolved = p.parentOf.map(item => {
            if (typeof item === 'string' && idToName[item]) return idToName[item];
            return item;
          });
          return {
            ...p,
            parentOf: resolved
          };
        });
      }
    } catch (e) {
      // if resolving fails, ignore and return raw parentOf values
      console.warn('Failed to resolve parentOf student names:', e && e.message);
    }
    return res.json(parents);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: delete parent user
router.delete("/:id", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({
      message: 'id required'
    });
    const user = await prisma.user.findUnique({
      where: {
        id: String(id)
      }
    });
    if (!user) return res.status(404).json({
      message: 'Parent not found'
    });
    if (user.role !== 'parent') return res.status(400).json({
      message: 'Not a parent account'
    });
    // notify parent by email about deletion (best-effort)
    try {
      const loginUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || '';
      const subject = 'Account deleted by administrator';
      const html = `
        <div style="font-family:Inter,Arial,sans-serif;background:#f7f7fb;padding:20px">
          <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
            <div style="background:linear-gradient(90deg,#ef4444,#f97316);padding:18px;color:#fff"><h2 style="margin:0">Account Deleted</h2></div>
            <div style="padding:16px;color:#333">
              <p>Hi ${user.name || user.username},</p>
              <p>This is to inform you that your parent account on the ERP system has been <strong>deleted</strong> by an administrator. You will no longer be able to log in.</p>
              <p>If you think this was a mistake, please contact the school administration.</p>
              <p style="margin-top:12px"><a href="${loginUrl}" style="display:inline-block;padding:8px 12px;background:linear-gradient(90deg,#7c3aed,#06b6d4);color:#fff;border-radius:6px;text-decoration:none">ERP Home</a></p>
            </div>
          </div>
        </div>
      `;
      await sendMail({
        to: user.username,
        subject,
        html
      }).catch(() => {});
    } catch (mailErr) {
      console.warn('Failed to notify parent about deletion:', mailErr && (mailErr.message || String(mailErr)));
    }
    await User.deleteOne({
      _id: id
    });
    return res.json({
      ok: true
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: block/unblock parent
router.put("/:id/block", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const id = req.params.id;
    const {
      block
    } = req.body || {};
    if (!id) return res.status(400).json({
      message: 'id required'
    });
    const user = await prisma.user.findUnique({
      where: {
        id: String(id)
      }
    });
    if (!user) return res.status(404).json({
      message: 'Parent not found'
    });
    if (user.role !== 'parent') return res.status(400).json({
      message: 'Not a parent account'
    });
    user.disabled = !!block;
    // Transpiled save()
    if (user && user.id) {
      const { id: _id_unused, ..._updateData } = user;
      await prisma.user.update({
        where: { id: String(user.id) },
        data: _updateData
      });
    } else if (user && user._id) {
      const { _id: _id_unused2, ..._updateData2 } = user;
      await prisma.user.update({
        where: { id: String(user._id) },
        data: _updateData2
      });
    }

    // notify parent by email about block/unblock (best-effort)
    try {
      const loginUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || '';
      const action = block ? 'blocked' : 'unblocked';
      const subject = `Your account has been ${action}`;
      const html = `
        <div style="font-family:Inter,Arial,sans-serif;background:#f7f7fb;padding:20px">
          <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
            <div style="background:linear-gradient(90deg,#6b7280,#374151);padding:18px;color:#fff"><h2 style="margin:0">Account ${action}</h2></div>
            <div style="padding:16px;color:#333">
              <p>Hi ${user.name || user.username},</p>
              <p>Your parent account on the ERP system has been <strong>${action}</strong> by an administrator.</p>
              ${block ? '<p>You will not be able to access the system until this decision is reversed.</p>' : '<p>You can now log in again.</p>'}
              <p style="margin-top:12px"><a href="${loginUrl}" style="display:inline-block;padding:8px 12px;background:linear-gradient(90deg,#7c3aed,#06b6d4);color:#fff;border-radius:6px;text-decoration:none">ERP Home</a></p>
            </div>
          </div>
        </div>
      `;
      await sendMail({
        to: user.username,
        subject,
        html
      }).catch(() => {});
    } catch (mailErr) {
      console.warn('Failed to notify parent about block/unblock:', mailErr && (mailErr.message || String(mailErr)));
    }
    return res.json({
      ok: true
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: create parent user
router.post("/", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      name,
      email,
      contact,
      address,
      parentOf,
      avatar,
      password
    } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({
      message: 'name, email and password required'
    });
    const exists = await prisma.user.findFirst({
      where: {
        username: email
      }
    }).catch(() => null);
    if (exists) return res.status(409).json({
      message: 'User already exists'
    });
    const hashed = await bcrypt.hash(password, 10);
    const created = await User.create({
      username: email,
      password: hashed,
      role: 'parent',
      name,
      contact: contact || '',
      address: address || '',
      parentOf: parentOf || [],
      avatar: avatar || ''
    });
    return res.status(201).json({
      id: created._id,
      username: created.username,
      name: created.name
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Parent: link by student access code
router.post("/link", verifyToken, requireRole('parent'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      code
    } = req.body || {};
    if (!code) return res.status(400).json({
      message: 'code required'
    });
    const student = await prisma.student.findFirst({
      where: {
        parentAccessCode: String(code).trim().toUpperCase()
      }
    }).catch(() => null);
    if (!student) return res.status(404).json({
      message: 'Invalid code'
    });
    const user = await prisma.user.findUnique({
      where: {
        id: String(req.user.sub)
      }
    });
    if (!user || user.role !== 'parent') return res.status(403).json({
      message: 'Unauthorized'
    });
    const sid = String(student._id);
    const exists = Array.isArray(user.parentOf) && user.parentOf.some(x => String(x) === sid);
    if (!exists) {
      if (!Array.isArray(user.parentOf)) user.parentOf = [];
      user.parentOf.push(sid);
      // Transpiled save()
    if (user && user.id) {
      const { id: _id_unused, ..._updateData } = user;
      await prisma.user.update({
        where: { id: String(user.id) },
        data: _updateData
      });
    } else if (user && user._id) {
      const { _id: _id_unused2, ..._updateData2 } = user;
      await prisma.user.update({
        where: { id: String(user._id) },
        data: _updateData2
      });
    }
    }
    return res.json({
      ok: true,
      student: {
        id: student._id,
        name: student.name,
        class: student.class,
        section: student.section,
        email: student.email
      }
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Parent/Admin: get receipts by studentId

  return router;
};
