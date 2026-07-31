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

// Messages (Parent -> Admin)
router.post("/", verifyToken, async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  const {
    parentName,
    studentName,
    className,
    subject,
    description,
    priority
  } = req.body || {};
  if (!description) return res.status(400).json({
    message: 'description required'
  });
  try {
    const m = await Message.create({
      data: {
        parentName,
        studentName,
        className,
        subject,
        description,
        priority,
        createdBy: req.user.sub,
        createdByUsername: req.user.username
      }
    });
    return res.status(201).json(m);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.get("/", verifyToken, async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    if (req.user.role === 'admin') {
      const all = await prisma.message.findMany({
        orderBy: {
          createdAt: "desc"
        }
      });
      return res.json(all);
    }
    // non-admins can only see their own messages
    const mine = await prisma.message.findMany({
      where: {
        createdBy: req.user.sub
      },

      orderBy: {
        createdAt: "desc"
      }
    });
    return res.json(mine);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.get("/my", verifyToken, async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const mine = await prisma.message.findMany({
      where: {
        createdBy: req.user.sub
      },

      orderBy: {
        createdAt: "desc"
      }
    });
    return res.json(mine);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.put("/:id/status", verifyToken, async (req, res) => {
  const {
    status,
    note
  } = req.body || {};
  if (!status) return res.status(400).json({
    message: 'status required'
  });
  try {
    const m = await prisma.message.findUnique({
      where: {
        id: String(req.params.id)
      }
    });
    if (!m) return res.status(404).json({
      message: 'Message not found'
    });
    const isAdmin = req.user && req.user.role === 'admin';
    const isOwner = req.user && (String(m.createdBy) === String(req.user.sub) || m.createdByUsername && m.createdByUsername === req.user.username);
    if (!isAdmin && !isOwner) return res.status(403).json({
      message: 'Forbidden: insufficient role'
    });

    // Allow admins to set any status. Message owners (parents) may only add replies
    // which are represented by the 'Replied' status to avoid privilege escalation.
    if (!isAdmin && status !== 'Replied') return res.status(403).json({
      message: 'Forbidden: insufficient role to set this status'
    });
    const entry = {
      by: req.user.username || req.user.sub,
      role: req.user.role || (isAdmin ? 'admin' : 'parent'),
      note: note || '',
      status,
      at: new Date()
    };
    m.status = status;
    m.history = m.history || [];
    m.history.push(entry);
    const saved = m; // Transpiled save()
    if (m) {
      const { id: _unused_id, _id: _unused__id, save: _unused_save, toObject: _unused_toObject, ..._updateData } = m;
      
      // Clean out relational arrays if any to prevent Prisma crash
      for (const k in _updateData) {
        if (Array.isArray(_updateData[k]) && _updateData[k].length > 0 && typeof _updateData[k][0] === 'object') {
           delete _updateData[k];
        }
      }

      await prisma.message.update({
        where: { id: String(((m.id || m._id))) },
        data: _updateData
      }).catch(e => console.error("Transpiled save error:", e.message));
    }
    return res.json(saved);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

  return router;
};
