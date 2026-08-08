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
    similarity, PDFDocument, fs, path, bcrypt, jwt, sendMail, sendCredentialEmail
  } = helpers;

// Admin: create new faculty member
router.post("/", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, subject, classGrade, contact, experience, employeeId, password } = req.body || {};
    if (!name) return res.status(400).json({ message: 'name is required' });

    let userId = null;
    let generatedPassword = null;

    if (email) {
      const existingUser = await prisma.user.findFirst({ where: { username: email } }).catch(() => null);
      if (!existingUser) {
        generatedPassword = password && String(password).trim().length >= 4
          ? String(password).trim()
          : (Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 90 + 10));
        const hashed = await bcrypt.hash(generatedPassword, 10);
        const createdUser = await User.create({
          data: {
            username: email,
            password: hashed,
            role: 'faculty',
            name: name,
            contact: contact || '',
            designation: 'Faculty / Teacher'
          }
        }).catch(err => {
          console.warn('Could not auto-create User for faculty:', err.message);
          return null;
        });
        if (createdUser) {
          userId = String(createdUser.id || createdUser._id);
        }
      } else {
        userId = String(existingUser.id || existingUser._id);
      }
    }

    const created = await prisma.faculty.create({
      data: {
        name,
        email,
        subject,
        classGrade,
        contact,
        experience,
        employeeId,
        userId,
        createdAt: new Date()
      }
    });

    if (email && generatedPassword) {
      try {
        await sendCredentialEmail({
          to: email,
          name: name,
          role: 'Faculty',
          username: email,
          password: generatedPassword,
          extraDetails: {
            'Employee ID': employeeId || '-',
            'Subject': subject || '-',
            'Class Grade': classGrade || '-'
          }
        });
      } catch (mailErr) {
        console.warn('Failed to send faculty creation credential email:', mailErr && (mailErr.message || String(mailErr)));
      }
    }

    return res.status(201).json(created);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

// Admin: update faculty fields (accept assignments, houses, role)
router.put("/:id", verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const id = req.params.id;
    const payload = req.body || {};
    const allowed = ['name', 'email', 'contact', 'experience', 'employeeId', 'subject', 'avatar', 'classGrade', 'assignments', 'houses', 'role'];
    const update = {};
    for (const k of allowed) {
      if (payload[k] !== undefined) update[k] = payload[k];
    }
    const doc = await prisma.faculty.update({
      where: {
        id: String(id)
      },

      data: update
    }).catch(() => null);
    if (!doc) return res.status(404).json({
      message: 'not found'
    });
    return res.json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Faculty dashboard - small summary for faculty (used by frontend to populate panel)
router.get("/dashboard", verifyToken, requireRole(['faculty', 'admin']), async (req, res) => {
  try {
    const userId = req.user && req.user.sub;
    const username = req.user && req.user.username;
    let fac = null;
    try {
      if (userId) fac = await prisma.faculty.findFirst({
        where: {
          OR: [{
            userId: userId
          }, {
            _id: userId
          }]
        }
      }).catch(() => null);
      if (!fac && username) fac = await prisma.faculty.findFirst({
        where: {
          OR: [{
            email: username
          }, {
            employeeId: username
          }]
        }
      }).catch(() => null);
    } catch (e) {
      fac = null;
    }

    // Count upcoming meetings linked to this faculty (if any)
    let upcomingMeetings = 0;
    try {
      if (fac && ((fac.id || fac._id))) {
        upcomingMeetings = await prisma.meeting.count({
          where: {
            facultyId: String(((fac.id || fac._id))),
            date: {
              gte: new Date()
            }
          }
        }).catch(() => 0);
      }
    } catch (e) {
      upcomingMeetings = 0;
    }

    // Normalize assigned classes into an array of class identifiers
    let assignedClasses = [];
    try {
      if (fac) {
        if (Array.isArray(fac.assignments) && fac.assignments.length) assignedClasses = fac.assignments.map(a => typeof a === 'object' && a !== null ? String(a.class) : String(a)).filter(Boolean);else if (Array.isArray(fac.classGrade)) assignedClasses = fac.classGrade.map(x => String(x)).filter(Boolean);else if (typeof fac.classGrade === 'string' && fac.classGrade.trim()) assignedClasses = [fac.classGrade.trim()];
      }
    } catch (e) {
      assignedClasses = [];
    }

    // Count students in those assigned classes (real-time)
    let assignedStudentsCount = 0;
    try {
      if (assignedClasses.length > 0) {
        assignedStudentsCount = await prisma.student.count({
          where: {
            class: {
              in: assignedClasses
            }
          }
        }).catch(() => 0);
      }
    } catch (e) {
      assignedStudentsCount = 0;
    }
    const summary = {
      faculty: fac ? {
        _id: ((fac.id || fac._id)),
        name: fac.name,
        email: fac.email,
        subject: fac.subject,
        classGrade: fac.classGrade
      } : null,
      upcomingMeetings: Number(upcomingMeetings) || 0,
      assignedClasses: assignedClasses,
      assignedClassesCount: assignedClasses.length,
      assignedStudentsCount: Number(assignedStudentsCount) || 0
    };
    return res.json(summary);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Faculty Attendance APIs

// Resolve current user's Faculty record
router.get("/me", verifyToken, async (req, res) => {
  try {
    const me = await prisma.user.findUnique({
      where: {
        id: String(req.user.sub)
      }
    }).catch(() => null);
    if (!me) return res.status(404).json({
      message: 'User not found'
    });
    let fac = await prisma.faculty.findFirst({
      where: {
        email: me.username
      }
    }).catch(() => null);
    if (!fac && me.name) fac = await prisma.faculty.findFirst({
      where: {
        name: me.name
      }
    }).catch(() => null);
    if (!fac && me.contact) fac = await prisma.faculty.findFirst({
      where: {
        contact: me.contact
      }
    }).catch(() => null);
    if (!fac) return res.status(404).json({
      message: 'Faculty record not linked'
    });
    // Normalize classGrade into assignments for frontend compatibility
    if (!fac.assignments || (Array.isArray(fac.assignments) && fac.assignments.length === 0)) {
      if (typeof fac.classGrade === 'string' && fac.classGrade.trim()) {
        fac.assignments = [{ class: fac.classGrade.trim(), sections: [], isClassTeacher: true }];
      } else if (Array.isArray(fac.classGrade) && fac.classGrade.length > 0) {
        fac.assignments = fac.classGrade.map(c => ({ class: String(c).trim(), sections: [], isClassTeacher: true }));
      }
    }
    return res.json(fac);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// login endpoint

// Faculty registration endpoint (public) - stores registration for admin approval
router.post("/register", async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      name,
      email,
      subject,
      education,
      contact,
      avatar,
      experience,
      classGrade,
      houses,
      password
    } = req.body || {};
    if (!name || !email) return res.status(400).json({
      message: 'name and email required'
    });
    const exists = await prisma.facultyRegistration.findFirst({
      where: {
        email
      }
    }).catch(() => null);
    if (exists && exists.status === 'pending') return res.status(409).json({
      message: 'Registration already submitted'
    });
    const reg = await FacultyRegistration.create({
      data: {
        name,
        email,
        subject,
        education,
        contact,
        avatar,
        experience,
        classGrade,
        houses: Array.isArray(houses) ? houses : [],
        password,
        status: 'pending'
      }
    });
    // send notification email to admin
    try {
      const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER || null;
      if (adminEmail) {
        const subjectAdmin = `New faculty registration: ${name}`;
        const htmlAdmin = `
          <div style="font-family:Arial,sans-serif;color:#333;padding:20px;background:#f7f7fb">
            <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
              <div style="background:linear-gradient(90deg,#6a4ef6,#9f7efe);padding:18px;color:white">
                <h2 style="margin:0;font-size:20px">New Faculty Registration</h2>
              </div>
              <div style="padding:18px">
                <p style="margin:0 0 10px">A new faculty has submitted a registration and is awaiting approval.</p>
                <table style="width:100%;border-collapse:collapse;margin-top:8px">
                  <tr><td style="font-weight:600;padding:6px 0">Name</td><td style="padding:6px 0">${name}</td></tr>
                  <tr><td style="font-weight:600;padding:6px 0">Email</td><td style="padding:6px 0">${email}</td></tr>
                  <tr><td style="font-weight:600;padding:6px 0">Subject</td><td style="padding:6px 0">${subject || '-'}</td></tr>
                  <tr><td style="font-weight:600;padding:6px 0">Class</td><td style="padding:6px 0">${classGrade || '-'}</td></tr>
                  <tr><td style="font-weight:600;padding:6px 0">Experience</td><td style="padding:6px 0">${experience || '-'}</td></tr>
                  <tr><td style="font-weight:600;padding:6px 0">Contact</td><td style="padding:6px 0">${contact || '-'}</td></tr>
                </table>
                <p style="margin-top:12px">Open the <a href="${process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || ''}/admin/approvals">Admin Approvals</a> page to review and approve.</p>
                <p style="color:#666;font-size:13px;margin-top:12px">This is an automated message.</p>
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
      console.warn('Failed to notify admin of registration:', mailErr && (mailErr.message || String(mailErr)));
    }

    // emit SSE event for admin UIs
    try {
      sendSseEvent('faculty_registration', {
        id: ((reg.id || reg._id)),
        name: reg.name,
        email: reg.email
      });
    } catch (e) {}
    return res.status(201).json(reg);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Student registration (public) -> admin approval

// Faculty: lesson planning management
router.get("/lesson-plans", verifyToken, requireRole(['faculty', 'admin']), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      class: cls,
      section,
      subject,
      status,
      from,
      to
    } = req.query || {};
    const q = {};
    if (req.user && req.user.role === 'faculty') q.facultyUserId = req.user.sub;
    if (cls) q.class = String(cls);
    if (section) q.section = String(section);
    if (subject) q.subject = { contains: String(subject), mode: 'insensitive' };
    if (status) q.status = String(status);
    if (from || to) {
      q.lessonDate = {};
      if (from) q.lessonDate.gte = String(from);
      if (to) q.lessonDate.lte = String(to);
    }
    const items = await prisma.lessonPlan.findMany({
      where: q,

      orderBy: [{
        lessonDate: "desc"
      }, {
        createdAt: "desc"
      }]
    });
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.post("/lesson-plans", verifyToken, requireRole('faculty'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      class: cls,
      section = 'ALL',
      subject,
      title,
      lessonDate,
      durationMinutes = 40,
      objectives = '',
      materials = '',
      activities = '',
      homework = '',
      assessment = '',
      status = 'planned',
      notes = ''
    } = req.body || {};
    if (!cls || !subject || !title || !lessonDate) return res.status(400).json({
      message: 'class, subject, title and lessonDate required'
    });
    const user = await prisma.user.findUnique({
      where: {
        id: String(req.user.sub)
      }
    }).catch(() => null);
    const faculty = await prisma.faculty.findFirst({
      where: {
        email: req.user.username
      }
    }).catch(() => null);
    const doc = await LessonPlan.create({
      data: {
        facultyUserId: req.user.sub,
        facultyId: faculty && ((faculty.id || faculty._id)),
        teacherName: faculty && faculty.name || user && user.name || req.user.username || '',
        class: String(cls),
        section: String(section || 'ALL'),
        subject: String(subject),
        title: String(title),
        lessonDate: String(lessonDate),
        durationMinutes: Number(durationMinutes || 40),
        objectives: String(objectives || ''),
        materials: String(materials || ''),
        activities: String(activities || ''),
        homework: String(homework || ''),
        assessment: String(assessment || ''),
        status: ['planned', 'in_progress', 'completed'].includes(String(status)) ? String(status) : 'planned',
        notes: String(notes || '')
      }
    });
    return res.status(201).json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.put("/lesson-plans/:id", verifyToken, requireRole('faculty'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const doc = await prisma.lessonPlan.findFirst({
      where: { id: req.params.id,
        facultyUserId: req.user.sub
      }
    });
    if (!doc) return res.status(404).json({
      message: 'Lesson plan not found'
    });
    const allowed = ['class', 'section', 'subject', 'title', 'lessonDate', 'durationMinutes', 'objectives', 'materials', 'activities', 'homework', 'assessment', 'status', 'notes'];
    allowed.forEach(key => {
      if (req.body && req.body[key] !== undefined) doc[key] = key === 'durationMinutes' ? Number(req.body[key] || 40) : String(req.body[key] || '');
    });
    if (!['planned', 'in_progress', 'completed'].includes(String(doc.status))) doc.status = 'planned';
    // Transpiled save()
    if (doc) {
      const { id: _unused_id, _id: _unused__id, save: _unused_save, toObject: _unused_toObject, ..._updateData } = doc;
      
      // Clean out relational arrays if any to prevent Prisma crash
      for (const k in _updateData) {
        if (Array.isArray(_updateData[k]) && _updateData[k].length > 0 && typeof _updateData[k][0] === 'object') {
           delete _updateData[k];
        }
      }

      await prisma.lessonPlan.update({
        where: { id: String(((doc.id || doc._id))) },
        data: _updateData
      }).catch(e => console.error("Transpiled save error:", e.message));
    }
    return res.json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.delete("/lesson-plans/:id", verifyToken, requireRole('faculty'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const doc = await LessonPlan.deleteMany({ where: {
      id: req.params.id,
      facultyUserId: req.user.sub
    } });
    if (!doc) return res.status(404).json({
      message: 'Lesson plan not found'
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
// Admin: list pending/processed faculty registrations
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
    const items = await prisma.facultyRegistration.findMany({
      where: q,

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

// Admin: approve registration -> create Faculty record and mark registration approved
router.put("/registrations/:id/approve", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const reg = await prisma.facultyRegistration.findUnique({
      where: {
        id: String(req.params.id)
      }
    });
    if (!reg) return res.status(404).json({
      message: 'Registration not found'
    });

    // Block reuse of email across roles
    const existingAccount = await prisma.user.findFirst({
      where: {
        username: reg.email
      }
    }).catch(() => null);
    if (existingAccount) return res.status(409).json({
      message: 'This email is already in use for another account'
    });

    // create Faculty record if not exists and ensure unique employeeId
    let facultyDoc = await prisma.faculty.findFirst({
      where: {
        email: reg.email
      }
    });
    if (!facultyDoc) {
      // generate unique employeeId (EMP + timestamp + random)
      function genId() {
        return `EMP${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
      }
      let empId = genId();
      // ensure uniqueness
      let attempts = 0;
      while (await prisma.faculty.findFirst({
        where: {
          employeeId: empId
        }
      })) {
        empId = genId();
        attempts++;
        if (attempts > 5) break;
      }
      facultyDoc = await Faculty.create({
        data: {
          name: reg.name,
          email: reg.email,
          employeeId: empId,
          subject: reg.subject,
          experience: reg.experience,
          contact: reg.contact,
          avatar: reg.avatar,
          classGrade: reg.classGrade,
          houses: Array.isArray(reg.houses) ? reg.houses : []
        }
      });
    }

    // create a login user for the faculty
    let user = null;
    let generatedPassword = reg.password && String(reg.password).length >= 6 ? String(reg.password) : Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 90 + 10);
    const hashed = await bcrypt.hash(generatedPassword, 10);
    user = await User.create({
      data: {
        username: reg.email,
        password: hashed,
        role: 'faculty',
        name: reg.name
      }
    });

    // mark registration approved
    reg.status = 'approved';
    // Transpiled save()
    if (reg) {
      const { id: _unused_id, _id: _unused__id, save: _unused_save, toObject: _unused_toObject, ..._updateData } = reg;
      
      // Clean out relational arrays if any to prevent Prisma crash
      for (const k in _updateData) {
        if (Array.isArray(_updateData[k]) && _updateData[k].length > 0 && typeof _updateData[k][0] === 'object') {
           delete _updateData[k];
        }
      }

      await prisma.facultyRegistration.update({
        where: { id: String(((reg.id || reg._id))) },
        data: _updateData
      }).catch(e => console.error("Transpiled save error:", e.message));
    }

    // notify admin UIs via SSE
    try {
      sendSseEvent('faculty_approved', {
        id: ((reg.id || reg._id)),
        name: reg.name,
        email: reg.email,
        employeeId: facultyDoc.employeeId
      });
    } catch (e) {}

    // try to send a congratulation email with credentials
    let mailStatus = {
      attempted: false,
      sent: false,
      info: null,
      error: null
    };
    try {
      mailStatus = await sendCredentialEmail({
        to: reg.email,
        name: reg.name,
        role: 'Teacher',
        username: reg.email,
        password: generatedPassword,
        extraDetails: {
          'Employee ID': facultyDoc.employeeId,
          'Subject': reg.subject || '-',
          'Class Grade': facultyDoc.classGrade || reg.classGrade || '-'
        }
      });
      if (mailStatus.sent) console.log('Teacher approval credential email sent to', reg.email);
    } catch (mailErr) {
      mailStatus.error = mailErr && (mailErr.message || String(mailErr));
      console.warn('Failed to send approval email:', mailStatus.error);
    }
    return res.json({
      registration: reg,
      faculty: facultyDoc,
      user: user ? {
        id: ((user.id || user._id)),
        username: user.username
      } : null,
      mail: mailStatus
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: list admins

// Admin: reject registration with optional note
router.put("/registrations/:id/reject", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      note
    } = req.body || {};
    const reg = await prisma.facultyRegistration.findUnique({
      where: {
        id: String(req.params.id)
      }
    });
    if (!reg) return res.status(404).json({
      message: 'Registration not found'
    });
    reg.status = 'rejected';
    reg.note = note || '';
    // Transpiled save()
    if (reg) {
      const { id: _unused_id, _id: _unused__id, save: _unused_save, toObject: _unused_toObject, ..._updateData } = reg;
      
      // Clean out relational arrays if any to prevent Prisma crash
      for (const k in _updateData) {
        if (Array.isArray(_updateData[k]) && _updateData[k].length > 0 && typeof _updateData[k][0] === 'object') {
           delete _updateData[k];
        }
      }

      await prisma.facultyRegistration.update({
        where: { id: String(((reg.id || reg._id))) },
        data: _updateData
      }).catch(e => console.error("Transpiled save error:", e.message));
    }
    return res.json(reg);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// protected profile

// Faculty management: list, update, delete (admin only)
router.get("/", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      name,
      employeeId,
      subject,
      email
    } = req.query || {};
    const q = {};
    if (name) q.name = {
      contains: name,
      mode: "insensitive"
    };
    if (employeeId) q.employeeId = {
      contains: employeeId,
      mode: "insensitive"
    };
    if (subject) q.subject = {
      contains: subject,
      mode: "insensitive"
    };
    if (email) q.email = {
      contains: email,
      mode: "insensitive"
    };
    const items = await prisma.faculty.findMany({
      where: q,

      orderBy: {
        name: "asc"
      }
    });

    // enrich with blocked status from User collection (if a user exists with same email)
    try {
      const emails = items.map(i => i.email).filter(Boolean);
      const users = emails.length ? await prisma.user.findMany({
        where: {
          username: {
            in: emails
          }
        }
      }) : [];
      const userMap = {};
      for (const u of users) userMap[u.username] = u;
      const enriched = items.map(i => ({
        ...i,
        blocked: !!(i.email && userMap[i.email] && userMap[i.email].disabled)
      }));
      return res.json(enriched);
    } catch (e) {
      return res.json(items);
    }
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.put("/:id", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const update = req.body || {};
    const updated = await prisma.faculty.update({
      where: {
        id: String(req.params.id)
      },

      data: update
    });
    if (!updated) return res.status(404).json({
      message: 'Faculty not found'
    });
    return res.json(updated);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Admin: block or unblock a faculty's user account (by faculty id)
router.put("/:id/block", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const {
      block
    } = req.body || {};
    const f = await prisma.faculty.findUnique({
      where: {
        id: String(req.params.id)
      }
    });
    if (!f) return res.status(404).json({
      message: 'Faculty not found'
    });
    const user = await prisma.user.findFirst({
      where: {
        username: f.email,
        role: 'faculty'
      }
    });
    if (!user) return res.status(404).json({
      message: 'User account not found for this faculty'
    });
    user.disabled = !!block;
    // Transpiled save()
    if (user) {
      const { id: _unused_id, _id: _unused__id, save: _unused_save, toObject: _unused_toObject, ..._updateData } = user;
      
      // Clean out relational arrays if any to prevent Prisma crash
      for (const k in _updateData) {
        if (Array.isArray(_updateData[k]) && _updateData[k].length > 0 && typeof _updateData[k][0] === 'object') {
           delete _updateData[k];
        }
      }

      await prisma.user.update({
        where: { id: String(((user.id || user._id))) },
        data: _updateData
      }).catch(e => console.error("Transpiled save error:", e.message));
    }
    try {
      sendSseEvent('faculty_blocked', {
        id: ((f.id || f._id)),
        email: f.email,
        blocked: user.disabled
      });
    } catch (e) {}
    return res.json({
      ok: true,
      blocked: user.disabled
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.delete("/:id", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const removed = await prisma.faculty.delete({
      where: {
        id: String(req.params.id)
      }
    });
    if (!removed) return res.status(404).json({
      message: 'Faculty not found'
    });
    // send removal email to faculty
    try {
      const to = removed.email;
      if (to) {
        const subject = 'Notice: You have been removed as Faculty';
        const html = `
          <div style="font-family:Arial,sans-serif;color:#333;padding:20px;background:#f7f7fb">
            <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
              <div style="background:linear-gradient(90deg,#ff5f6d,#ffc371);padding:18px;color:white">
                <h2 style="margin:0;font-size:20px">Account Removed</h2>
              </div>
              <div style="padding:18px">
                <p style="margin:0 0 10px">Dear ${removed.name || 'Faculty'},</p>
                <p style="margin:0 0 10px">This is to inform you that your faculty account (Employee ID: <strong>${removed.employeeId || 'N/A'}</strong>) has been removed by the administration.</p>
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
      console.warn('Failed to send removal email:', mailErr && (mailErr.message || String(mailErr)));
    }

    // try to also remove the login user for this faculty (if any)
    try {
      const u = await User.deleteMany({ where: {
        username: removed.email,
        role: 'faculty'
      } }).catch(() => null);
      if (u) console.log('Removed user account for', removed.email);
    } catch (e) {
      console.warn('Failed to remove user account for deleted faculty', e && e.message);
    }

    // emit SSE event so admin UI can refresh lists
    try {
      sendSseEvent('faculty_deleted', {
        id: ((removed.id || removed._id)),
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

// Syllabus

  return router;
};
