
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

// Leaves: student apply for leave
router.post("/", verifyToken, async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      from,
      to,
      reason
    } = req.body || {};
    if (!from || !to) return res.status(400).json({
      message: 'from and to required'
    });

    // try to enrich with student or faculty record if available
    let student = null;
    let faculty = null;
    try {
      student = await Student.findOne({
        email: req.user.username
      }).lean().catch(() => null);
    } catch (e) {
      student = null;
    }
    try {
      faculty = await Faculty.findOne({
        email: req.user.username
      }).lean().catch(() => null);
    } catch (e) {
      faculty = null;
    }
    const leaveData = {
      userId: req.user.sub || null,
      username: req.user.name || req.user.username || req.user.sub,
      email: student && student.email || faculty && faculty.email || req.user.username || '',
      class: student && student.class || '',
      section: student && student.section || '',
      rollNo: student && (student.rollNo || student.roll) || '',
      department: faculty && faculty.department || faculty && faculty.subject || '',
      role: req.user.role || 'student',
      from: new Date(from),
      to: new Date(to),
      reason: reason || '',
      status: 'Pending'
    };
    const doc = await Leave.create(leaveData);
    // notify admin UIs via SSE
    try {
      sendSseEvent('leave_created', {
        id: doc._id,
        email: doc.email,
        username: doc.username
      });
    } catch (e) {}
    return res.status(201).json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Get leaves: admins see all, others see their own
router.get("/", verifyToken, async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    if (req.user && req.user.role === 'admin') {
      // allow admin to filter by role (student/faculty) using query param
      const q = {};
      if (req.query && req.query.role) q.role = req.query.role;
      const items = await Leave.find(q).sort({
        createdAt: -1
      }).lean();
      return res.json(items);
    }
    // Faculty may request student leaves for their assigned classes via ?role=student
    if (req.user && req.user.role === 'faculty' && req.query && req.query.role === 'student') {
      // resolve faculty record
      const u = await User.findById(req.user.sub).lean().catch(() => null);
      if (!u) return res.status(403).json({
        message: 'Unauthorized'
      });
      let fac = await Faculty.findOne({
        email: u.username
      }).lean().catch(() => null);
      if (!fac && u.name) fac = await Faculty.findOne({
        name: u.name
      }).lean().catch(() => null);
      if (!fac && u.contact) fac = await Faculty.findOne({
        contact: u.contact
      }).lean().catch(() => null);
      if (!fac) return res.status(403).json({
        message: 'Faculty record not linked'
      });
      const q = {
        role: 'student'
      };
      // build class/section restrictions
      const orClauses = [];
      for (const a of fac.assignments || []) {
        if (!a.class) continue;
        if (a.isClassTeacher) {
          // match class (any section)
          orClauses.push({
            class: String(a.class)
          });
        } else if (a.section) {
          orClauses.push({
            class: String(a.class),
            section: String(a.section)
          });
        }
      }
      if (orClauses.length === 0) return res.json([]);
      q.$or = orClauses;
      const items = await Leave.find(q).sort({
        createdAt: -1
      }).lean();
      return res.json(items);
    }
    // non-admins: list only own leaves
    const mine = await Leave.find({
      userId: req.user.sub
    }).sort({
      createdAt: -1
    }).lean();
    return res.json(mine);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Get my leaves (explicit)
router.get("/my", verifyToken, async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const mine = await Leave.find({
      userId: req.user.sub
    }).sort({
      createdAt: -1
    }).lean();
    return res.json(mine);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Update leave status (admin only) - accept optional note
router.put("/:id/status", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      status,
      note
    } = req.body || {};
    if (!status) return res.status(400).json({
      message: 'status required'
    });
    const id = req.params.id;
    const l = await Leave.findById(id);
    if (!l) return res.status(404).json({
      message: 'Leave not found'
    });
    l.status = status;
    l.reviewedBy = req.user.name || req.user.username || req.user.sub;
    l.reviewedAt = new Date();
    l.reviewNote = note || '';
    await l.save();

    // attempt to send email notification to student
    try {
      const to = l.email || l.username || '';
      if (to) {
        const subject = `Your leave request has been ${status}`;
        const text = `Hello ${l.username || ''},\n\nYour leave request from ${l.from ? new Date(l.from).toLocaleDateString() : ''} to ${l.to ? new Date(l.to).toLocaleDateString() : ''} has been ${status}.\n\nNote from admin: ${l.reviewNote || 'No note provided.'}\n\nRegards, Admin`;
        if (status === 'Approved') {
          await notifyEvent({
            event: 'leave_approved',
            phone: l.contact,
            message: text,
            emailOpts: {
              to,
              subject,
              text
            }
          }).catch(() => {});
        } else {
          await sendMail({
            to,
            subject,
            text
          }).catch(() => {});
        }
      }
    } catch (mailErr) {
      console.warn('Failed to notify student about leave status change:', mailErr && (mailErr.message || String(mailErr)));
    }
    try {
      sendSseEvent('leave_updated', {
        id: l._id,
        status: l.status,
        email: l.email
      });
    } catch (e) {}
    return res.json(l);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: upload syllabus for a class/section

router.post("/", verifyToken, async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  const {
    from,
    to,
    reason
  } = req.body || {};
  if (!from || !to) return res.status(400).json({
    message: 'from and to dates required'
  });
  try {
    const l = await Leave.create({
      userId: req.user.sub,
      username: req.user.username,
      from: new Date(from),
      to: new Date(to),
      reason
    });
    return res.status(201).json(l);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.get("/", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const all = await Leave.find().sort({
      createdAt: -1
    }).lean();
    return res.json(all);
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
    const mine = await Leave.find({
      userId: req.user.sub
    }).sort({
      createdAt: -1
    }).lean();
    return res.json(mine);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Messages (Parent -> Admin)

router.put("/:id/status", verifyToken, requireRole('admin'), async (req, res) => {
  const {
    status,
    note
  } = req.body || {};
  if (!status) return res.status(400).json({
    message: 'status required'
  });
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({
      message: 'Leave not found'
    });
    leave.status = status;
    leave.reviewedBy = req.user && (req.user.username || req.user.sub);
    leave.reviewedAt = new Date();
    leave.reviewNote = note || '';
    const saved = await leave.save();

    // If approved and user is faculty, auto-mark absent in faculty attendance for the date range
    try {
      if (String(status).toLowerCase() === 'approved') {
        // find faculty by email/username
        let faculty = await Faculty.findOne({
          email: leave.username
        }).lean().catch(() => null);
        if (!faculty && leave.userId) {
          // attempt via userId mapping: if there's a Faculty with contact/email matching user
          const u = await User.findById(leave.userId).lean().catch(() => null);
          if (u && u.username) faculty = await Faculty.findOne({
            email: u.username
          }).lean().catch(() => null);
        }
        if (faculty && faculty._id && leave.from && leave.to) {
          const start = new Date(leave.from);
          start.setHours(0, 0, 0, 0);
          const end = new Date(leave.to);
          end.setHours(0, 0, 0, 0);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const ymd = d.toISOString().slice(0, 10);
            let att = await FacultyAttendance.findOne({
              date: ymd
            });
            const rec = {
              facultyId: faculty._id,
              status: 'absent',
              markedBy: req.user.sub
            };
            if (att) {
              // replace or add record for this faculty
              const idx = Array.isArray(att.records) ? att.records.findIndex(r => String(r.facultyId) === String(faculty._id)) : -1;
              if (idx >= 0) att.records[idx] = rec;else att.records.push(rec);
              att.createdBy = req.user.sub;
              await att.save();
            } else {
              await FacultyAttendance.create({
                date: ymd,
                records: [rec],
                createdBy: req.user.sub
              });
            }
          }
        }
      }
    } catch (autoErr) {
      console.warn('Auto-mark absent for faculty leave failed:', autoErr && (autoErr.message || String(autoErr)));
    }

    // try to notify user by email (best-effort)
    try {
      let recipient = null;
      // if username looks like an email, use it
      if (leave.username && String(leave.username).includes('@')) recipient = leave.username;
      // else try to find a Student record with same username
      if (!recipient) {
        const student = await Student.findOne({
          name: leave.username
        }).lean().catch(() => null);
        if (student && student.email) recipient = student.email;
      }
      // as a fallback, try to locate a User with the id and use its contact/email-like fields
      if (!recipient && leave.userId) {
        const u = await User.findById(leave.userId).lean().catch(() => null);
        if (u && u.contact && String(u.contact).includes('@')) recipient = u.contact;
      }
      if (recipient) {
        const subject = `Leave ${status}: ${leave.username}`;
        const text = `Your leave request from ${leave.from.toISOString().slice(0, 10)} to ${leave.to.toISOString().slice(0, 10)} has been ${status}.\n\nNote from reviewer: ${note || ''}`;
        let phone = null;
        if (u && u.contact) phone = u.contact;
        if (status === 'Approved' && phone) {
          await notifyEvent({
            event: 'leave_approved',
            phone,
            message: text,
            emailOpts: {
              to: recipient,
              subject,
              text
            }
          }).catch(() => {});
        } else {
          await sendMail({
            to: recipient,
            subject,
            text
          });
        }
      } else {
        console.log('No email found for leave user, skipping email');
      }
    } catch (mailErr) {
      console.warn('Failed to send leave status email:', mailErr && mailErr.message);
    }
    return res.json(saved);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Faculty: request deletion of a student (creates a DeletionRequest)

  return router;
};
