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

// Student deletion requests (admin): list and approve
router.get("/delete-requests", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await prisma.DeletionRequest.findMany().sort({
      createdAt: -1
    }).catch(() => []);
    return res.json(list || []);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.put("/delete-requests/:id/approve", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const id = req.params && req.params.id;
    if (!id) return res.status(400).json({
      message: 'id required'
    });
    const reqDoc = await prisma.deletionrequest.findUnique({ where: { id: String(id) } }).catch(() => null);
    if (!reqDoc) return res.status(404).json({
      message: 'Request not found'
    });

    // delete student record if present
    try {
      if (reqDoc.studentId) {
        await prisma.student.delete({ where: { id: String(reqDoc.studentId) } }).catch(() => null);
      }
    } catch (e) {/* ignore */}

    // delete associated user account by email if exists
    try {
      if (reqDoc.studentEmail) {
        await User.findOneAndDelete({
          username: reqDoc.studentEmail
        }).catch(() => null);
      }
    } catch (e) {/* ignore */}

    // remove the deletion request document
    try {
      await prisma.deletionrequest.delete({ where: { id: String(id) } }).catch(() => null);
    } catch (e) {/* ignore */}
    return res.json({
      ok: true,
      message: 'Student deleted and request removed'
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Create a report card (admin/faculty)

// Return current authenticated student's document
// This handler tries multiple strategies to resolve the student document:
// 1) If `req.user.sub` matches a Student _id, return that
// 2) Otherwise, try to resolve by `req.user.username` (email)
// 3) If still not found, return 404
router.get("/me", verifyToken, async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const userId = req.user && req.user.sub;
    const username = req.user && req.user.username;
    let s = null;
    if (userId) {
      try {
        s = await prisma.student.findUnique({ where: { id: String(userId) } }).catch(() => null);
      } catch (e) {
        s = null;
      }
    }
    if (!s && username) {
      try {
        s = await Student.findOne({
          email: username
        }).catch(() => null);
      } catch (e) {
        s = null;
      }
    }
    if (!s) return res.status(404).json({
      message: 'Student record not found'
    });
    return res.json(s);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// helper to generate short parent access codes

router.put("/:id/change-house", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const {
      house
    } = req.body || {};
    const allowed = ['Blue', 'Green', 'Red', 'Yellow'];
    if (!allowed.includes(String(house))) return res.status(400).json({
      message: 'Invalid house'
    });
    const doc = await Student.findByIdAndUpdate(id, {
      $set: {
        house
      }
    }, {
      new: true
    }).catch(() => null);
    if (!doc) return res.status(404).json({
      message: 'Student not found'
    });
    return res.json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Set or clear a student's house role (e.g., Captain/Leader)
router.put("/:id/house-role", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const {
      role
    } = req.body || {};
    const doc = await Student.findByIdAndUpdate(id, {
      $set: {
        houseRole: role || ''
      }
    }, {
      new: true
    }).catch(() => null);
    if (!doc) return res.status(404).json({
      message: 'Student not found'
    });
    return res.json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Bulk change house for many students at once
router.post("/bulk-change-house", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const updates = Array.isArray(req.body) ? req.body : req.body.updates;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        message: 'No updates provided'
      });
    }
    const allowed = ['Blue', 'Green', 'Red', 'Yellow'];
    const ops = updates.filter(u => u && u.id && allowed.includes(String(u.house))).map(u => ({
      updateOne: {
        filter: {
          _id: u.id
        },
        update: {
          $set: {
            house: u.house
          }
        }
      }
    }));
    if (ops.length === 0) return res.status(400).json({
      message: 'No valid updates'
    });
    const result = await Student.bulkWrite(ops, {
      ordered: false
    });
    const modifiedCount = result.modifiedCount ?? (result.nModified || 0);
    return res.json({
      ok: true,
      modifiedCount
    });
  } catch (err) {
    console.error('bulk-change-house error', err);
    return res.status(500).json({
      message: 'Failed to bulk update houses'
    });
  }
});

// Generic file upload endpoint - returns public URL for uploaded file

// Student registration (public) -> admin approval
router.post("/register", async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      name,
      email,
      class: className,
      address,
      school,
      accessId,
      avatar,
      medium
    } = req.body || {};
    if (!name || !email) return res.status(400).json({
      message: 'name and email required'
    });
    const exists = await StudentRegistration.findOne({
      email
    }).catch(() => null);
    if (exists && exists.status === 'pending') return res.status(409).json({
      message: 'Registration already submitted'
    });
    const reg = await StudentRegistration.create({
      name,
      email,
      class: className,
      medium: medium || 'English',
      address,
      school,
      accessId: accessId || '123',
      avatar,
      status: 'pending'
    });

    // notify admin by email
    try {
      const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER || null;
      if (adminEmail) {
        const subjectAdmin = `New student registration: ${name}`;
        const htmlAdmin = `
          <div style="font-family:Arial,sans-serif;color:#333;padding:20px;background:#f7f7fb">
            <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
              <div style="background:linear-gradient(90deg,#16a34a,#60a5fa);padding:18px;color:white">
                <h2 style="margin:0;font-size:20px">New Student Registration</h2>
              </div>
              <div style="padding:18px">
                <p>A new student has submitted a registration and is awaiting approval.</p>
                <table style="width:100%;border-collapse:collapse;margin-top:8px">
                  <tr><td style="font-weight:600;padding:6px 0">Name</td><td style="padding:6px 0">${name}</td></tr>
                  <tr><td style="font-weight:600;padding:6px 0">Email</td><td style="padding:6px 0">${email}</td></tr>
                  <tr><td style="font-weight:600;padding:6px 0">Class</td><td style="padding:6px 0">${className || '-'}</td></tr>
                  <tr><td style="font-weight:600;padding:6px 0">School</td><td style="padding:6px 0">${school || '-'}</td></tr>
                </table>
                <p style="margin-top:12px">Open the <a href="${process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || ''}/admin/student-approvals">Student Approvals</a> page to review and approve.</p>
              </div>
            </div>
          </div>
        `;
        sendMail({
          to: adminEmail,
          subject: subjectAdmin,
          html: htmlAdmin
        }).catch(() => {});
      }
    } catch (mailErr) {
      console.warn('Failed to notify admin of student registration:', mailErr && (mailErr.message || String(mailErr)));
    }

    // SSE
    try {
      sendSseEvent('student_registration', {
        id: reg._id,
        name: reg.name,
        email: reg.email,
        class: reg.class
      });
    } catch (e) {}
    return res.status(201).json(reg);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: list student registrations
router.get("/registrations", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      status
    } = req.query || {};
    const q = {};
    if (status) q.status = status;
    const items = await prisma.studentregistration.findMany({ where: q }).sort({
      createdAt: -1
    });
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Faculty/Admin: list students by class/section
router.get("/", verifyToken, requireRole(['admin', 'faculty']), async (req, res, next) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      class: cls,
      section,
      name,
      email,
      house,
      stream
    } = req.query || {};
    // If advanced filters are present, defer to the enhanced handler defined later
    if (name || email || house) return next();
    const q = {};
    if (cls) q.class = String(cls);
    if (section) q.section = String(section);
    if (stream) q.stream = String(stream);
    const items = await prisma.student.findMany({ where: q }).sort({
      class: 1,
      section: 1,
      rollNo: 1
    });
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// NOTE: Student route consolidated earlier. Removed duplicate handler to avoid
// multiple handlers for the same path which can produce unexpected behavior.

// Student: get or generate parent access code for the logged-in student
router.get("/parent-code", verifyToken, requireRole('student'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const s = await Student.findOne({
      email: req.user.username
    });
    if (!s) return res.status(404).json({
      message: 'Student record not found'
    });
    if (!s.parentAccessCode) {
      s.parentAccessCode = generateParentCode();
      await s.save();
    }
    return res.json({
      code: s.parentAccessCode
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Attendance endpoints

// Admin: approve student registration

// Admin: reject student registration

// Admin: list pending/processed faculty registrations

// Admin: approve registration -> create Faculty record and mark registration approved

// Admin: list admins

// Admin: create admin (admin-only)

// Admin: delete admin user

// Admin: block/unblock admin

// Admin: update admin details (contact, designation)

// Staff: list staff (non-admin employees)

// Staff: create staff (non-admin)

// Staff: delete staff user

// Staff: block/unblock staff

// Staff: update staff details

// HR management (admin) - expose endpoints for frontend `/api/hr` calls

// Admin: list parents

// Admin: delete parent user

// Admin: block/unblock parent

// Admin: create parent user

// Parent: link by student access code

// Parent/Admin: get receipts by studentId

// Parent/Admin: basic student info (limited fields)

// Admin: reject registration with optional note

// protected profile

// Update profile: updates User fields and tries to sync Student/Faculty when possible

// Password reset: request reset (creates token, emails user)

// Password reset: apply new password
router.put("/registrations/:id/approve", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const reg = await prisma.studentregistration.findUnique({ where: { id: String(req.params.id) } });
    if (!reg) return res.status(404).json({
      message: 'Registration not found'
    });

    // Block if email is already used by any account (admin/faculty/student/staff)
    const existingAccount = await User.findOne({
      username: reg.email
    }).catch(() => null);
    if (existingAccount) return res.status(409).json({
      message: 'This email is already in use for another account'
    });

    // assign section A-D with capacity 50
    const sections = ['A', 'B', 'C', 'D'];
    let assignedSection = null;
    for (const s of sections) {
      const count = await Student.countDocuments({
        class: reg.class,
        section: s
      });
      if (count < 50) {
        assignedSection = s;
        break;
      }
    }
    if (!assignedSection) return res.status(400).json({
      message: 'Class is full'
    });

    // roll number: class + section + next number
    const existing = await Student.countDocuments({
      class: reg.class,
      section: assignedSection
    });
    const rollNo = `${reg.class}${assignedSection}${existing + 1}`;
    const studentDoc = await Student.create({
      name: reg.name,
      email: reg.email,
      class: reg.class,
      section: assignedSection,
      rollNo,
      avatar: reg.avatar,
      medium: reg.medium || 'English'
    });

    // create user
    let user = null;
    let generatedPassword = null;
    generatedPassword = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 90 + 10);
    const hashed = await bcrypt.hash(generatedPassword, 10);
    user = await User.create({
      username: reg.email,
      password: hashed,
      role: 'student',
      name: reg.name
    });
    reg.status = 'approved';
    await reg.save();

    // send congratulation email with credentials
    try {
      const loginUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || '';
      const subject = 'Congratulations — your student registration has been approved';
      const html = `
        <div style="font-family: Inter, Arial, sans-serif; background:#f3f4f6; padding:24px;">
          <div style="max-width:680px;margin:0 auto;">
            <div style="background:linear-gradient(90deg,#06b6d4,#7c3aed);padding:20px;border-radius:10px 10px 0 0;color:#fff;text-align:left;">
              <h1 style="margin:0;font-size:22px;">Congratulations ${reg.name}!</h1>
              <div style="margin-top:6px;opacity:0.95">Your student registration has been approved.</div>
            </div>
            <div style="background:#ffffff;padding:18px;border:1px solid #e8e8f0;border-top:0;border-radius:0 0 10px 10px;">
              <p style="margin:0 0 12px;color:#374151">An account has been created for you on our ERP system. Below are your account details — keep them secure.</p>
              <table style="width:100%;border-collapse:collapse;margin-top:8px;border-radius:6px;overflow:hidden;box-shadow:0 6px 18px rgba(99,102,241,0.08)">
                <tr><td style="padding:12px 12px;background:#f9fafb;font-weight:700;color:#111;border-bottom:1px solid #f1f1f5;width:40%">Username</td><td style="padding:12px 16px;background:#fff;border-bottom:1px solid #f1f1f5">${reg.email}</td></tr>
                ${generatedPassword ? `<tr><td style="padding:8px 12px;background:#fafafa;font-weight:600;border-top:1px solid #eee">Password</td><td style="padding:8px 12px;background:#fafafa"><strong>${generatedPassword}</strong></td></tr>` : ''}
                <tr><td style="padding:12px 12px;background:#f9fafb;font-weight:700;color:#111;border-top:1px solid #f1f1f5">Class</td><td style="padding:12px 16px;background:#fff">${reg.class}</td></tr>
                <tr><td style="padding:12px 12px;background:#f9fafb;font-weight:700;color:#111;border-top:1px solid #f1f1f5">Section</td><td style="padding:12px 16px;background:#fff">${assignedSection}</td></tr>
                <tr><td style="padding:12px 12px;background:#f9fafb;font-weight:700;color:#111;border-top:1px solid #f1f1f5">Roll No</td><td style="padding:12px 16px;background:#fff">${rollNo}</td></tr>
              </table>
              <div style="margin-top:16px;text-align:left"><a href="${loginUrl}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:linear-gradient(90deg,#7c3aed,#06b6d4);color:white;text-decoration:none;font-weight:600">Login to ERP</a></div>
              <p style="margin-top:14px;color:#6b7280;font-size:13px">Please change your password after first login.</p>
              <p style="margin-top:10px;color:#9ca3af;font-size:12px">If you did not expect this email or there is an issue, please contact the administrator.</p>
              <div style="margin-top:18px;color:#6b7280;font-size:13px">Regards,<br/>Admin</div>
            </div>
          </div>
        </div>
      `;
      await sendMail({
        to: reg.email,
        subject,
        html
      });
    } catch (mailErr) {
      console.warn('Failed to send student approval email:', mailErr && (mailErr.message || String(mailErr)));
    }

    // SSE
    try {
      sendSseEvent('student_approved', {
        id: reg._id,
        name: reg.name,
        email: reg.email,
        class: reg.class,
        section: assignedSection
      });
    } catch (e) {}
    return res.json({
      registration: reg.toObject(),
      student: studentDoc.toObject(),
      user: user ? {
        id: user._id,
        username: user.username
      } : null
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.put("/registrations/:id/reject", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      note
    } = req.body || {};
    const reg = await prisma.studentregistration.findUnique({ where: { id: String(req.params.id) } });
    if (!reg) return res.status(404).json({
      message: 'Registration not found'
    });
    reg.status = 'rejected';
    reg.note = note || '';
    await reg.save();

    // notify student by email
    try {
      const subject = 'Your student registration has been rejected';
      const html = `
        <div style="font-family:Arial,sans-serif;padding:20px;background:#f7f7fb">
          <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
            <div style="background:linear-gradient(90deg,#ef4444,#fb923c);padding:18px;color:white"><h2 style="margin:0">Registration Update</h2></div>
            <div style="padding:18px"><p>Dear ${reg.name || 'Applicant'},</p><p>Your student registration has been reviewed and <strong>rejected</strong>.</p><p>Note from admin: ${reg.note || 'No note provided.'}</p><p>If you have questions, contact the administration.</p></div>
          </div>
        </div>
      `;
      await sendMail({
        to: reg.email,
        subject,
        html
      });
    } catch (mailErr) {
      console.warn('Failed to send student rejection email:', mailErr && (mailErr.message || String(mailErr)));
    }
    try {
      sendSseEvent('student_rejected', {
        id: reg._id,
        name: reg.name,
        email: reg.email
      });
    } catch (e) {}
    return res.json(reg);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.get("/:id/basic", verifyToken, requireRole(['admin', 'parent']), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({
      message: 'id required'
    });
    if ((req.user && req.user.role) === 'parent') {
      const parent = await prisma.user.findUnique({ where: { id: String(req.user.sub) } }).catch(() => null);
      const linked = parent && Array.isArray(parent.parentOf) && parent.parentOf.some(x => String(x) === String(id));
      if (!linked) return res.status(403).json({
        message: 'Parent is not linked to this student'
      });
    }
    const s = await prisma.student.findUnique({ where: { id: String(id) } }).select('name class section email assignedFees').catch(() => null);
    if (!s) return res.status(404).json({
      message: 'Student not found'
    });
    return res.json(s);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
// Students - list/filter (admin or faculty)
router.get("/", verifyToken, requireRole(['admin', 'faculty']), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      name,
      class: className,
      section,
      email,
      house,
      gender,
      category,
      religion
    } = req.query || {};
    const q = {};
    if (name) q.name = {
      $regex: name,
      $options: 'i'
    };
    if (className) q.class = String(className);
    if (section) q.section = String(section);
    if (email) q.email = {
      $regex: email,
      $options: 'i'
    };
    if (house) q.house = String(house);
    if (gender) q.gender = String(gender);
    if (category) q.category = String(category);
    if (religion) q.religion = String(religion);
    let items = await prisma.student.findMany({ where: q }).sort({
      class: 1,
      section: 1,
      rollNo: 1
    });
    // enrich with blocked status from User collection (if a user exists with same email)
    try {
      const emails = items.map(i => i.email).filter(Boolean);
      const users = emails.length ? await User.find({
        username: {
          $in: emails
        }
      }) : [];
      const userMap = {};
      for (const u of users) userMap[u.username] = u;
      items = items.map(i => {
        const userDisabled = !!(i.email && userMap[i.email] && userMap[i.email].disabled);
        const studentBlocked = !!i.blocked;
        return {
          ...i,
          blocked: userDisabled || studentBlocked
        };
      });
    } catch (e) {
      // if enrichment fails, return items as-is
    }
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: create student directly (auto-assign section and rollNo, create login user and email credentials)
router.post("/", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      name,
      email,
      class: className,
      password,
      gender = '',
      category = '',
      religion = '',
      medium = 'English',
      house = ''
    } = req.body || {};
    if (!name || !email || !className) return res.status(400).json({
      message: 'name, email and class required'
    });

    // prevent duplicate usage of the same email across ERP
    const existingStudent = await Student.findOne({
      email
    }).catch(() => null);
    if (existingStudent) return res.status(409).json({
      message: 'Student with this email already exists'
    });
    const existingUserAnyRole = await User.findOne({
      username: email
    }).catch(() => null);
    if (existingUserAnyRole) return res.status(409).json({
      message: 'This email is already in use for another account'
    });

    // assign section by finding first section with capacity < 50
    const sections = ['A', 'B', 'C', 'D'];
    let assignedSection = null;
    for (const s of sections) {
      const count = await Student.countDocuments({
        class: String(className),
        section: s
      }).catch(() => 0);
      if (count < 50) {
        assignedSection = s;
        break;
      }
    }
    if (!assignedSection) return res.status(400).json({
      message: 'Class is full or no section available'
    });

    // compute roll number: class + section + next number
    const existingCount = await Student.countDocuments({
      class: String(className),
      section: assignedSection
    }).catch(() => 0);
    const rollNo = `${String(className)}${assignedSection}${existingCount + 1}`;

    // create student record
    let studentDoc;
    try {
      studentDoc = await Student.create({
        name,
        email,
        class: String(className),
        section: assignedSection,
        rollNo,
        gender: String(gender),
        category: String(category),
        religion: String(religion),
        medium: medium || 'English',
        ...(house ? {
          house: String(house)
        } : {})
      });
    } catch (err) {
      if (err && (err.code === 11000 || /duplicate key/i.test(String(err.message)))) {
        return res.status(409).json({
          message: 'Student with this email already exists'
        });
      }
      throw err;
    }

    // create login user for student if not exists
    let user = await User.findOne({
      username: email
    });
    let generatedPassword = null;
    if (!user) {
      if (password && String(password).trim().length >= 4) {
        generatedPassword = String(password);
      } else {
        generatedPassword = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 90 + 10);
      }
      const hashed = await bcrypt.hash(generatedPassword, 10);
      try {
        user = await User.create({
          username: email,
          password: hashed,
          role: 'student',
          name
        });
      } catch (err) {
        if (err && (err.code === 11000 || /duplicate key/i.test(String(err.message)))) {
          // Username already exists; keep existing user reference
          user = await User.findOne({
            username: email
          });
        } else {
          throw err;
        }
      }
    }

    // send welcome email with credentials (if SMTP configured)
    try {
      const loginUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || '';
      const subject = 'Welcome — your student account has been created';
      const html = `
        <div style="font-family:Inter,Arial,sans-serif;background:#f3f4f6;padding:20px;">
          <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
            <div style="background:linear-gradient(90deg,#06b6d4,#7c3aed);padding:18px;color:white"><h2 style="margin:0">Welcome ${name}!</h2></div>
            <div style="padding:16px;color:#333">
              <p>Your student account has been created. Below are your login details — please change your password after first login.</p>
              <table style="width:100%;border-collapse:collapse;margin-top:8px">
                <tr><td style="font-weight:700;padding:6px 0">Username</td><td style="padding:6px 0">${email}</td></tr>
                ${generatedPassword ? `<tr><td style="font-weight:700;padding:6px 0">Password</td><td style="padding:6px 0"><strong>${generatedPassword}</strong></td></tr>` : ''}
                <tr><td style="font-weight:700;padding:6px 0">Class</td><td style="padding:6px 0">${className}</td></tr>
                <tr><td style="font-weight:700;padding:6px 0">Section</td><td style="padding:6px 0">${assignedSection}</td></tr>
                <tr><td style="font-weight:700;padding:6px 0">Roll No</td><td style="padding:6px 0">${rollNo}</td></tr>
              </table>
              <p style="margin-top:12px"><a href="${loginUrl}" style="display:inline-block;padding:10px 14px;background:linear-gradient(90deg,#7c3aed,#06b6d4);color:#fff;border-radius:8px;text-decoration:none">Login to ERP</a></p>
            </div>
          </div>
        </div>
      `;
      await sendMail({
        to: email,
        subject,
        html
      });
    } catch (mailErr) {
      console.warn('Failed to send student creation email:', mailErr && (mailErr.message || String(mailErr)));
    }

    // SSE notify admin UI
    try {
      sendSseEvent('student_created', {
        id: studentDoc._id,
        name: studentDoc.name,
        email: studentDoc.email,
        class: studentDoc.class,
        section: studentDoc.section
      });
    } catch (e) {}
    return res.status(201).json({
      student: studentDoc.toObject(),
      user: user ? {
        id: user._id,
        username: user.username
      } : null
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Create an assignment (faculty)

// Admin: delete a student (remove student record and associated user, notify student)
router.delete("/:id", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const removed = await prisma.student.delete({ where: { id: String(req.params.id) } });
    if (!removed) return res.status(404).json({
      message: 'Student not found'
    });

    // Remove associated login user if it's a student account
    try {
      await User.findOneAndDelete({
        username: removed.email,
        role: 'student'
      }).catch(() => {});
    } catch (e) {/* ignore */}

    // send removal email to student
    try {
      const to = removed.email;
      if (to) {
        const subject = 'Notice: Your student account has been removed';
        const html = `
          <div style="font-family:Arial,sans-serif;color:#333;padding:20px;background:#f7f7fb">
            <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
              <div style="background:linear-gradient(90deg,#ff5f6d,#ffc371);padding:18px;color:white">
                <h2 style="margin:0;font-size:20px">Account Removed</h2>
              </div>
              <div style="padding:18px">
                <p style="margin:0 0 10px">Dear ${removed.name || 'Student'},</p>
                <p style="margin:0 0 10px">This is to inform you that your student account (Roll No: <strong>${removed.rollNo || 'N/A'}</strong>) has been removed by the administration.</p>
                <p style="margin-top:8px">If you believe this was done in error or need assistance, please contact the school administration.</p>
                <p style="color:#666;font-size:13px;margin-top:12px">Regards,<br/>Admin</p>
              </div>
            </div>
          </div>
        `;
        sendMail({
          to,
          subject,
          html
        }).catch(() => {});
      }
    } catch (mailErr) {
      console.warn('Failed to send student removal email:', mailErr && (mailErr.message || String(mailErr)));
    }

    // emit SSE event so admin UI can refresh lists
    try {
      sendSseEvent('student_deleted', {
        id: removed._id,
        email: removed.email,
        name: removed.name
      });
    } catch (e) {}
    return res.json({
      ok: true
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: update a student's class/section/roll/name and optional demographics
router.put("/:id", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const id = req.params.id;
    const update = {};
    const {
      class: cls,
      section,
      rollNo,
      name,
      gender,
      category,
      religion,
      medium,
      house
    } = req.body || {};
    if (cls !== undefined) update.class = String(cls);
    if (section !== undefined) update.section = String(section);
    if (rollNo !== undefined) update.rollNo = String(rollNo);
    if (name !== undefined) update.name = String(name);
    if (gender !== undefined) update.gender = String(gender);
    if (category !== undefined) update.category = String(category);
    if (religion !== undefined) update.religion = String(religion);
    if (medium !== undefined) update.medium = String(medium);
    if (house !== undefined) update.house = String(house);
    if (!id) return res.status(400).json({
      message: 'id required'
    });
    const student = await prisma.student.findUnique({ where: { id: String(id) } });
    if (!student) return res.status(404).json({
      message: 'Student not found'
    });

    // detect changes for notification
    const before = {
      name: student.name,
      class: student.class,
      section: student.section,
      rollNo: student.rollNo,
      gender: student.gender,
      category: student.category,
      religion: student.religion,
      medium: student.medium,
      house: student.house
    };

    // If medium changed, reassign section & roll number to balance sections
    const beforeMedium = student.medium;
    Object.assign(student, update);
    if (medium !== undefined && String(beforeMedium || '') !== String(medium || '')) {
      // find a section with capacity < 50 for the student's current class
      const sections = ['A', 'B', 'C', 'D'];
      let assignedSection = null;
      for (const s of sections) {
        const count = await Student.countDocuments({
          class: String(student.class),
          section: s
        });
        if (count < 50) {
          assignedSection = s;
          break;
        }
      }
      if (assignedSection) {
        const existingCount = await Student.countDocuments({
          class: String(student.class),
          section: assignedSection
        });
        const newRollNo = `${String(student.class)}${assignedSection}${existingCount + 1}`;
        student.section = assignedSection;
        student.rollNo = newRollNo;
      }
    }
    await student.save();

    // also update associated User.name if user exists
    try {
      const user = await User.findOne({
        username: student.email,
        role: 'student'
      });
      if (user && name !== undefined) {
        user.name = String(name);
        await user.save();
      }
    } catch (e) {/* ignore */}

    // prepare list of changed fields
    const after = {
      name: student.name,
      class: student.class,
      section: student.section,
      rollNo: student.rollNo,
      gender: student.gender,
      category: student.category,
      religion: student.religion,
      medium: student.medium,
      house: student.house
    };
    const changed = [];
    for (const k of ['name', 'class', 'section', 'rollNo', 'gender', 'category', 'religion', 'medium', 'house']) {
      if (String(before[k] || '') !== String(after[k] || '')) changed.push(k);
    }

    // send notification email if something changed
    if (changed.length > 0) {
      try {
        const to = student.email;
        if (to) {
          const loginUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || '';
          const subject = 'Your student record has been updated';
          const rows = [`<tr><td style=\"font-weight:700;padding:6px 0\">Name</td><td style=\"padding:6px 0\">${after.name || '-'}</td></tr>`, `<tr><td style="font-weight:700;padding:6px 0">Class</td><td style="padding:6px 0">${after.class || '-'}</td></tr>`, `<tr><td style="font-weight:700;padding:6px 0">Section</td><td style="padding:6px 0">${after.section || '-'}</td></tr>`, `<tr><td style=\"font-weight:700;padding:6px 0\">Roll No</td><td style=\"padding:6px 0\">${after.rollNo || '-'}</td></tr>`, `<tr><td style=\"font-weight:700;padding:6px 0\">Gender</td><td style=\"padding:6px 0\">${after.gender || '-'}</td></tr>`, `<tr><td style=\"font-weight:700;padding:6px 0\">Category</td><td style=\"padding:6px 0\">${after.category || '-'}</td></tr>`, `<tr><td style=\"font-weight:700;padding:6px 0\">Religion</td><td style=\"padding:6px 0\">${after.religion || '-'}</td></tr>`, `<tr><td style=\"font-weight:700;padding:6px 0\">Medium</td><td style=\"padding:6px 0\">${after.medium || '-'}</td></tr>`, `<tr><td style=\"font-weight:700;padding:6px 0\">House</td><td style=\"padding:6px 0\">${after.house || '-'}</td></tr>`];
          const html = `
            <div style="font-family:Inter,Arial,sans-serif;background:#f3f4f6;padding:20px;">
              <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
                <div style="background:linear-gradient(90deg,#06b6d4,#7c3aed);padding:18px;color:white"><h2 style="margin:0">Student Record Updated</h2></div>
                <div style="padding:16px;color:#333">
                  <p>Dear ${after.name || after.email || 'Student'},</p>
                  <p>Your student record has been <strong>updated by the administration</strong>. Below are your current details:</p>
                  <table style="width:100%;border-collapse:collapse;margin-top:8px">
                    ${rows.join('\n')}
                  </table>
                  <p style="margin-top:12px">You can login to your account here: <a href="${loginUrl}" style="color:#2563eb">${loginUrl}</a></p>
                  <p style="margin-top:12px;font-size:13px;color:#666">If you did not expect this change, please contact the administration immediately.</p>
                </div>
              </div>
            </div>
          `;
          await sendMail({
            to,
            subject,
            html
          }).catch(() => {});
        }
      } catch (mailErr) {
        console.warn('Failed to send student update email:', mailErr && (mailErr.message || String(mailErr)));
      }
    }
    try {
      sendSseEvent('student_updated', {
        id: student._id,
        email: student.email,
        changed
      });
    } catch (e) {}
    return res.json(student);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Faculty: change a student's class (assign new section & roll no automatically)
router.put("/:id/change-class", verifyToken, requireRole('faculty'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const id = req.params.id;
    const {
      class: newClass,
      section: requestedSection
    } = req.body || {};
    if (!id || !newClass) return res.status(400).json({
      message: 'id and class required'
    });
    const student = await prisma.student.findUnique({ where: { id: String(id) } });
    if (!student) return res.status(404).json({
      message: 'Student not found'
    });

    // Ensure the calling faculty is the class teacher for the student's current class
    // Resolve faculty record from the authenticated user
    let faculty = null;
    try {
      const me = req.user || {};
      faculty = await Faculty.findOne({
        email: me.username
      }).catch(() => null);
      if (!faculty && me.name) faculty = await Faculty.findOne({
        name: me.name
      }).catch(() => null);
      if (!faculty && me.contact) faculty = await Faculty.findOne({
        contact: me.contact
      }).catch(() => null);
    } catch (e) {
      faculty = null;
    }
    if (!faculty) return res.status(403).json({
      message: 'Faculty record not found for this user'
    });
    const isClassTeacherForCurrent = (faculty.assignments || []).some(a => String(a.class) === String(student.class) && a.isClassTeacher);
    if (!isClassTeacherForCurrent) return res.status(403).json({
      message: 'Only the class teacher of this class can change class or section'
    });

    // assign section: if a specific section was requested, try to use it (with capacity check)
    const sections = ['A', 'B', 'C', 'D'];
    let assignedSection = null;
    if (requestedSection) {
      const normalized = String(requestedSection || '').trim().toUpperCase();
      if (!sections.includes(normalized)) return res.status(400).json({
        message: 'Invalid section requested'
      });
      const cnt = await Student.countDocuments({
        class: String(newClass),
        section: normalized
      });
      if (cnt >= 50) return res.status(400).json({
        message: 'Requested section is full'
      });
      assignedSection = normalized;
    } else {
      for (const s of sections) {
        const count = await Student.countDocuments({
          class: String(newClass),
          section: s
        });
        if (count < 50) {
          assignedSection = s;
          break;
        }
      }
    }
    if (!assignedSection) return res.status(400).json({
      message: 'No section available for the selected class'
    });
    const existingCount = await Student.countDocuments({
      class: String(newClass),
      section: assignedSection
    });
    const rollNo = `${String(newClass)}${assignedSection}${existingCount + 1}`;
    const before = {
      class: student.class,
      section: student.section,
      rollNo: student.rollNo
    };
    student.class = String(newClass);
    student.section = assignedSection;
    student.rollNo = rollNo;
    await student.save();

    // update associated user name if exists
    try {
      const user = await User.findOne({
        username: student.email,
        role: 'student'
      });
      if (user) {
        user.name = student.name || user.name;
        await user.save();
      }
    } catch (e) {}

    // notify student by email
    try {
      const to = student.email;
      if (to) {
        const subject = 'Your student class has been updated';
        const html = `Hello ${student.name || ''},\n\nYour class has been changed to ${student.class} (Section ${student.section}, Roll ${student.rollNo}).\n\nIf you have questions, contact administration.`;
        await sendMail({
          to,
          subject,
          text: html
        }).catch(() => {});
      }
    } catch (mailErr) {
      console.warn('Failed to send class-change email:', mailErr && (mailErr.message || String(mailErr)));
    }
    try {
      sendSseEvent('student_updated', {
        id: student._id,
        class: student.class,
        section: student.section
      });
    } catch (e) {}
    return res.json(student);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Faculty: set a student's stream (only permitted for faculty role)
router.put("/:id/stream", verifyToken, requireRole('faculty'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const id = req.params.id;
    const {
      stream
    } = req.body || {};
    if (!id) return res.status(400).json({
      message: 'id required'
    });
    const student = await prisma.student.findUnique({ where: { id: String(id) } });
    if (!student) return res.status(404).json({
      message: 'Student not found'
    });

    // Only applicable for classes 11 and 12; enforce on server as well
    const cls = String(student.class || '');
    if (!(cls === '11' || cls === '12')) return res.status(400).json({
      message: 'Stream only applicable for class 11 and 12'
    });
    student.stream = stream ? String(stream).trim() : '';
    await student.save();
    try {
      sendSseEvent('student_updated', {
        id: student._id,
        changed: ['stream']
      });
    } catch (e) {}
    return res.json(student);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Faculty: block/unblock student (faculty-initiated)
router.put("/:id/block-by-faculty", verifyToken, requireRole('faculty'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const id = req.params.id;
    const {
      block
    } = req.body || {};
    if (block === undefined) return res.status(400).json({
      message: 'block required'
    });
    const student = await prisma.student.findUnique({ where: { id: String(id) } });
    if (!student) return res.status(404).json({
      message: 'Student not found'
    });
    const user = await User.findOne({
      username: student.email,
      role: 'student'
    });
    let finalBlocked = !!block;
    if (user) {
      user.disabled = !!block;
      await user.save();
      finalBlocked = !!user.disabled;
    }
    student.blocked = !!block;
    await student.save();

    // email notify
    try {
      const to = student.email;
      if (to) {
        const subject = finalBlocked ? 'Your student account has been blocked' : 'Your student account has been unblocked';
        const text = `Dear ${student.name || ''},\n\nYour account has been ${finalBlocked ? 'blocked' : 'unblocked'} by the faculty. Please contact admin for more details.`;
        await sendMail({
          to,
          subject,
          text
        }).catch(() => {});
      }
    } catch (mailErr) {
      console.warn('Failed to send block email:', mailErr && (mailErr.message || String(mailErr)));
    }
    try {
      sendSseEvent('student_blocked', {
        id: student._id,
        email: student.email,
        blocked: !!finalBlocked
      });
    } catch (e) {}
    return res.json({
      ok: true,
      blocked: !!finalBlocked
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Faculty: create a delete request for a student (goes to admin approvals)
router.post("/:id/delete-request", verifyToken, requireRole('faculty'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const id = req.params.id;
    const {
      note
    } = req.body || {};
    if (!id) return res.status(400).json({
      message: 'id required'
    });
    const student = await prisma.student.findUnique({ where: { id: String(id) } });
    if (!student) return res.status(404).json({
      message: 'Student not found'
    });
    const existing = await DeletionRequest.findOne({
      studentId: id,
      status: 'pending'
    });
    if (existing) return res.status(409).json({
      message: 'Delete request already pending'
    });
    const dr = await DeletionRequest.create({
      studentId: id,
      studentEmail: student.email || '',
      requestedBy: req.user.sub,
      requestedByName: req.user.name || req.user.username,
      note: note || '',
      status: 'pending'
    });
    try {
      sendSseEvent('student_delete_requested', {
        id: dr._id,
        studentId: id,
        email: student.email
      });
    } catch (e) {}
    return res.status(201).json(dr);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: list delete requests
router.get("/delete-requests", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const items = await prisma.deletionrequest.findMany().sort({
      createdAt: -1
    });
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: approve a delete request (deletes student and user)
router.put("/delete-requests/:id/approve", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const id = req.params.id;
    const reqDoc = await prisma.deletionrequest.findUnique({ where: { id: String(id) } });
    if (!reqDoc) return res.status(404).json({
      message: 'Request not found'
    });
    if (reqDoc.status !== 'pending') return res.status(400).json({
      message: 'Request already processed'
    });
    const student = await prisma.student.findUnique({ where: { id: String(reqDoc.studentId) } });
    if (student) {
      await Student.deleteOne({
        _id: student._id
      });
      try {
        await User.findOneAndDelete({
          username: student.email,
          role: 'student'
        }).catch(() => {});
      } catch (e) {}
    }
    reqDoc.status = 'approved';
    await reqDoc.save();

    // notify student by email
    try {
      const to = reqDoc.studentEmail;
      if (to) {
        const subject = 'Student record deleted';
        const text = `Dear ${reqDoc.requestedByName || ''},\n\nYour delete request has been approved and the student record has been removed.`;
        await sendMail({
          to,
          subject,
          text
        }).catch(() => {});
      }
    } catch (mailErr) {
      console.warn('Failed to send deletion approved email:', mailErr && (mailErr.message || String(mailErr)));
    }
    try {
      sendSseEvent('student_deleted', {
        id: reqDoc.studentId,
        email: reqDoc.studentEmail
      });
    } catch (e) {}
    return res.json({
      ok: true
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: block/unblock a student's login account (by student id)
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

    // load student document (not lean) so we can set a student-level blocked flag if needed
    const studentDoc = await prisma.student.findUnique({ where: { id: String(id) } });
    if (!studentDoc) return res.status(404).json({
      message: 'Student not found'
    });

    // try to find associated login user
    const user = await User.findOne({
      username: studentDoc.email,
      role: 'student'
    });

    // if user exists, set its disabled flag
    let finalBlocked = !!block;
    if (user) {
      user.disabled = !!block;
      await user.save();
      finalBlocked = !!user.disabled;
    }

    // also persist blocked flag on student record so block state is visible even without a User
    studentDoc.blocked = !!block;
    await studentDoc.save();

    // send notification email to student about block/unblock only if email exists
    try {
      const to = studentDoc.email;
      if (to) {
        const loginUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || '';
        const subject = finalBlocked ? 'Your student account has been blocked' : 'Your student account has been unblocked';
        const html = `
          <div style="font-family:Inter,Arial,sans-serif;background:#f3f4f6;padding:20px;">
            <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
              <div style="background:linear-gradient(90deg,${finalBlocked ? '#ef4444,#fb923c' : '#06b6d4,#7c3aed'});padding:18px;color:white"><h2 style="margin:0">Account ${finalBlocked ? 'Blocked' : 'Unblocked'}</h2></div>
              <div style="padding:16px;color:#333">
                <p>Dear ${studentDoc.name || 'Student'},</p>
                <p>Your student account (${studentDoc.email}) has been <strong>${finalBlocked ? 'blocked' : 'unblocked'}</strong> by the administration.</p>
                <p style="margin-top:12px">You can access the portal here: <a href="${loginUrl}" style="color:#2563eb">${loginUrl}</a></p>
                <p style="margin-top:12px;font-size:13px;color:#666">If you believe this was done in error, please contact the administration.</p>
              </div>
            </div>
          </div>
        `;
        await sendMail({
          to,
          subject,
          html
        }).catch(() => {});
      }
    } catch (mailErr) {
      console.warn('Failed to send student block/unblock email:', mailErr && (mailErr.message || String(mailErr)));
    }
    try {
      sendSseEvent('student_blocked', {
        id: studentDoc._id,
        email: studentDoc.email,
        blocked: !!finalBlocked
      });
    } catch (e) {}
    return res.json({
      ok: true,
      blocked: !!finalBlocked
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Faculty management: list, update, delete (admin only)

// Faculty: request deletion of a student (creates a DeletionRequest)
router.post("/:id/delete-request", verifyToken, requireRole('faculty'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const student = await prisma.student.findUnique({ where: { id: String(req.params.id) } });
    if (!student) return res.status(404).json({
      message: 'Student not found'
    });
    const {
      note
    } = req.body || {};
    const doc = {
      studentId: student._id,
      studentEmail: student.email || '',
      studentName: student.name || '',
      class: student.class || '',
      section: student.section || '',
      rollNo: student.rollNo || '',
      requestedBy: req.user && req.user.sub,
      requestedByName: req.user && (req.user.name || req.user.username || ''),
      note: note || '',
      status: 'pending'
    };
    const created = await prisma.deletionrequest.create({ data: doc });
    try {
      sendSseEvent('student_delete_requested', {
        id: created._id,
        studentId: student._id,
        studentEmail: student.email
      });
    } catch (e) {}
    return res.status(201).json(created);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: list deletion requests
router.get("/delete-requests", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const items = await prisma.deletionrequest.findMany().sort({
      createdAt: -1
    });
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: approve a deletion request (deletes the student and associated user)
router.put("/delete-requests/:id/approve", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const reqDoc = await prisma.deletionrequest.findUnique({ where: { id: String(req.params.id) } });
    if (!reqDoc) return res.status(404).json({
      message: 'Delete request not found'
    });

    // delete student record if exists
    try {
      if (reqDoc.studentId) {
        await prisma.student.delete({ where: { id: String(reqDoc.studentId) } }).catch(() => null);
      }
      // also delete associated User (login) if exists
      if (reqDoc.studentEmail) {
        await User.findOneAndDelete({
          username: reqDoc.studentEmail,
          role: 'student'
        }).catch(() => null);
      }
    } catch (inner) {
      console.warn('Error deleting student/user during approve:', inner && inner.message);
    }
    reqDoc.status = 'approved';
    await reqDoc.save();

    // notify requester and student by email (best-effort)
    try {
      const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER || null;
      const toStudent = reqDoc.studentEmail || null;
      if (toStudent) {
        const subject = 'Account deleted by admin';
        const html = `<div style="font-family:Arial,sans-serif;padding:20px;background:#f7f7fb"><div style="max-width:600px;margin:0 auto;background:#fff;padding:18px;border-radius:8px">Your student account (${reqDoc.studentEmail}) has been removed by admin.</div></div>`;
        await sendMail({
          to: toStudent,
          subject,
          html
        }).catch(() => {});
      }
      // notify requester (if requester has an email username)
      if (reqDoc.requestedByName) {
        const subject = 'Delete request approved';
        const html = `<div style="font-family:Arial,sans-serif;padding:20px;background:#f7f7fb"><div style="max-width:600px;margin:0 auto;background:#fff;padding:18px;border-radius:8px">Your delete request for ${reqDoc.studentEmail || reqDoc.studentName} has been approved and the student record removed.</div></div>`;
        // try to find the requester user and email
        try {
          const requester = await prisma.user.findUnique({ where: { id: String(reqDoc.requestedBy) } }).catch(() => null);
          if (requester && requester.username && String(requester.username).includes('@')) {
            await sendMail({
              to: requester.username,
              subject,
              html
            }).catch(() => {});
          }
        } catch (e) {}
      }
    } catch (mailErr) {
      console.warn('Failed to send delete approval emails:', mailErr && mailErr.message);
    }
    try {
      sendSseEvent('student_deleted', {
        studentEmail: reqDoc.studentEmail,
        studentId: reqDoc.studentId
      });
    } catch (e) {}
    return res.json({
      ok: true
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Bulk test creation from a .docx file (parses questions/options/answers/marks)

  return router;
};
