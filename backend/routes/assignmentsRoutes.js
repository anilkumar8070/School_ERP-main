const express = require('express');

module.exports = function(helpers) {
  const router = express.Router();
  const { prisma, Assignment, Submission, verifyToken, requireRole, upload, sendSseEvent } = helpers;

  // List assignments (any authenticated user can read)
  router.get("/", verifyToken, async (req, res) => {
    try {
      const q = {};
      const { class: cls, section } = req.query || {};
      if (cls) q.class = String(cls);
      if (section && section !== 'ALL') {
        q.OR = [
          { section: String(section) },
          { section: 'ALL' }
        ];
      }
      
      const items = await prisma.assignment.findMany({
        where: q,
        orderBy: { createdAt: "desc" }
      }).catch(() => []);
      
      return res.json(items);
    } catch (e) {
      console.error('GET / assignments failed:', e);
      return res.status(500).json({ message: e.message });
    }
  });

  // Create assignment (faculty or admin)
  router.post("/", verifyToken, requireRole(['admin', 'faculty']), upload.single('file'), async (req, res) => {
    try {
      const body = req.body || {};
      if (!body.title || !body.class) return res.status(400).json({ message: 'title and class required' });
      
      const file = req.file;
      const filePath = file ? `/uploads/${file.filename}` : '';
      
      const doc = await Assignment.create({
        data: {
          title: String(body.title || ''),
          description: String(body.description || ''),
          subject: String(body.subject || ''),
          class: String(body.class || ''),
          section: body.section || 'ALL',
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          filePath,
          createdBy: req.user && req.user.sub
        }
      });

      if (!doc) {
        throw new Error('Failed to create assignment in database');
      }

      try {
        if (typeof sendSseEvent === 'function') {
          sendSseEvent('assignment_created', {
            id: ((doc.id || doc._id)),
            class: doc.class,
            section: doc.section
          });
        }
      } catch (sseError) {
        console.error('SSE failed:', sseError);
      }

      return res.status(201).json(doc);
    } catch (e) {
      console.error('POST / assignments failed:', e);
      return res.status(500).json({ message: e.message });
    }
  });

  // Student: submit an assignment
  router.post("/:id/submit", verifyToken, requireRole('student'), upload.single('file'), async (req, res) => {
    try {
      const aid = req.params.id;
      const assignment = await prisma.assignment.findUnique({
        where: { id: String(aid) }
      }).catch(() => null);
      
      if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
      
      if (assignment.dueDate) {
        const now = new Date();
        const due = new Date(assignment.dueDate);
        if (now > due) return res.status(403).json({ message: 'Submission window closed: assignment due date passed' });
      }
      
      const username = req.user && req.user.username;
      const studentRec = await prisma.student.findFirst({
        where: { email: username }
      }).catch(() => null);
      
      const file = req.file;
      const filePath = file ? `/uploads/${file.filename}` : (req.body && req.body.filePath ? String(req.body.filePath) : '');
      
      const sub = await Submission.create({
        data: {
          assignmentId: aid,
          studentId: studentRec ? (((studentRec.id || studentRec._id))) : undefined,
          studentName: studentRec ? studentRec.name : (req.body.studentName || ''),
          studentRoll: studentRec ? studentRec.rollNo : (req.body.studentRoll || ''),
          studentClass: studentRec ? studentRec.class : (req.body.studentClass || ''),
          studentEmail: username || (req.body.studentEmail || ''),
          answerText: req.body.answerText ? String(req.body.answerText) : '',
          filePath,
          submittedAt: new Date()
        }
      });

      if (!sub) {
        throw new Error('Failed to submit assignment to database');
      }

      try {
        if (typeof sendSseEvent === 'function') {
          sendSseEvent('assignment_submitted', {
            assignmentId: aid,
            studentEmail: username
          });
        }
      } catch (sseError) {
        console.error('SSE failed:', sseError);
      }

      return res.status(201).json(sub);
    } catch (e) {
      console.error('POST /:id/submit failed:', e);
      return res.status(500).json({ message: e.message });
    }
  });

  // List submissions for an assignment
  router.get("/:id/submissions", verifyToken, async (req, res) => {
    try {
      const aid = req.params.id;
      const role = req.user && req.user.role;
      const username = req.user && req.user.username;
      const q = { assignmentId: aid };
      
      if (role === 'student') {
        q.studentEmail = username;
      } else if (role === 'parent') {
        const { studentId } = req.query || {};
        if (!studentId) return res.status(400).json({ message: 'studentId required for parent' });
        
        const user = await prisma.user.findUnique({
          where: { id: String(req.user.sub) }
        }).catch(() => null);
        
        if (!user || user.role !== 'parent') return res.status(403).json({ message: 'Unauthorized' });
        
        const allowed = Array.isArray(user.parentOf) && user.parentOf.some(x => String(x) === String(studentId));
        if (!allowed) return res.status(403).json({ message: 'Not linked to this student' });
        
        q.studentId = studentId;
      }
      
      const subs = await prisma.submission.findMany({
        where: q,
        orderBy: { createdAt: "desc" }
      }).catch(() => []);
      
      return res.json(subs);
    } catch (e) {
      console.error('GET /:id/submissions failed:', e);
      return res.status(500).json({ message: e.message });
    }
  });

  // Extend assignment due date
  router.put("/:id/extend", verifyToken, requireRole(['admin', 'faculty']), async (req, res) => {
    try {
      const { dueDate } = req.body || {};
      if (!dueDate) return res.status(400).json({ message: 'dueDate required' });
      
      const doc = await prisma.assignment.findUnique({
        where: { id: req.params.id }
      }).catch(() => null);
      
      if (!doc) return res.status(404).json({ message: 'Assignment not found' });
      
      const updated = await prisma.assignment.update({
        where: { id: req.params.id },
        data: { dueDate: new Date(dueDate) }
      });
      
      return res.json(updated);
    } catch (e) {
      console.error('PUT /:id/extend failed:', e);
      return res.status(500).json({ message: e.message });
    }
  });

  return router;
};
