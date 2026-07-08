const TransportAllocation = require('./models/TransportAllocation');
const TransportReceipt = require('./models/TransportReceipt');

// Consolidate pdfkit require in one place to avoid duplicate declarations
var PDFDocument;
try { PDFDocument = require('pdfkit') } catch (e) { PDFDocument = null }

function registerTransportRoutes() {
  // ===================== Transport Allocation APIs =====================
  // List allocations (optionally filter by studentId or routeId)
  app.get('/api/transport/allocations', verifyToken, requireRole('admin'), async (req, res) => {
    try {
      const { studentId, routeId } = req.query || {}
      const filter = {}
      if (studentId) filter['student.id'] = studentId
      if (routeId) filter.routeId = routeId
      const list = await TransportAllocation.find(filter).sort({ createdAt: -1 }).lean().catch(() => [])
      // Attach latest receipt info (if any) to each allocation for admin convenience
      try {
        const allocIds = list.map(l => l._id).filter(Boolean)
        if (allocIds.length > 0) {
          const recs = await TransportReceipt.find({ allocationId: { $in: allocIds } }).sort({ createdAt: -1 }).lean().catch(() => [])
          const map = {}
          for (const r of recs) {
            const key = String(r.allocationId || r.allocationId)
            if (!map[key]) map[key] = r
          }
          for (const l of list) {
            const k = String(l._id)
            if (map[k]) {
              l.receiptId = map[k]._id
              l.receiptPdfUrl = map[k].pdfUrl || ''
            }
          }
        }
      } catch (e) { console.warn('Failed to attach transport receipts to allocations', e && e.message) }
      return res.json(list)
    } catch (e) { return res.status(500).json({ message: e.message }) }
  });

  // Create allocation
  app.post('/api/transport/allocations', verifyToken, requireRole('admin'), async (req, res) => {
    try {
      const payload = req.body || {}
      const required = ['when', 'routeId', 'stopId', 'busId', 'seatNo', 'student', 'fee']
      for (const k of required) { if (payload[k] === undefined || payload[k] === null) return res.status(400).json({ message: `${k} required` }) }
      const doc = await TransportAllocation.create(payload)
      // Optionally, add fee to student's assignedFees or create a receipt stub
      try {
        if (payload.fee && payload.student && payload.student.id) {
          const note = `Transport Route ${payload.routeId} Stop ${payload.stopId} Bus ${payload.busId} Seat ${payload.seatNo}`
          if (String(payload.fee.option) === 'add-to-fee') {
            const entry = { term: 'Transport', amount: Number(payload.fee.amount || 0), note, by: req.user && req.user.sub }
            await Student.findByIdAndUpdate(payload.student.id, { $push: { assignedFees: entry } }).lean().catch(() => null)
          } else if (String(payload.fee.option) === 'pay-now') {
            try {
              // create a transport receipt record (minimal fields)
              const alloc = doc
              const amount = Number(payload.fee.amount || 0)
              const bodyRouteName = payload.routeName || ''
              const bodyStopName = payload.stopId || ''
              const bodyBusName = payload.busId || ''
              const razorpay_order_id = payload.razorpayOrderId || payload.razorpay_order_id || null
              const razorpay_payment_id = payload.razorpayPaymentId || payload.razorpay_payment_id || null
              const razorpay_signature = payload.razorpaySignature || payload.razorpay_signature || null

              const receipt = await TransportReceipt.create({
                allocationId: alloc ? alloc._id : null,
                studentId: payload.student && payload.student.id ? payload.student.id : null,
                busId: alloc ? alloc.busId : '',
                routeName: (bodyRouteName || (alloc ? (alloc.routeName || '') : '')),
                stopName: (bodyStopName || (alloc ? (alloc.stopName || '') : '')),
                busName: (bodyBusName || (alloc ? (alloc.busName || '') : '')),
                seatNo: alloc ? alloc.seatNo : '',
                amount: Number(amount || 0) || 0,
                razorpayOrderId: razorpay_order_id,
                razorpayPaymentId: razorpay_payment_id,
                razorpaySignature: razorpay_signature || ''
              })
              console.log('Created transport receipt', receipt && receipt._id)

              // generate PDF
              try {
                const gen = await generateReceiptPdf(receipt.toObject ? receipt.toObject() : receipt, alloc && alloc.toObject ? alloc.toObject() : alloc, 'transport')
                if (gen) {
                  receipt.pdfPath = gen.pdfPath
                  receipt.pdfUrl = gen.pdfUrl
                  await receipt.save().catch(() => null)
                }
              } catch (e) { console.warn('pdf gen failed on transport confirm', e && e.message) }

              // update allocation payments
              try {
                if (alloc) {
                  const payments = alloc.payments || []
                  const p = { amount: Number(receipt.amount || 0), orderId: razorpay_order_id, paymentId: razorpay_payment_id, receiptId: String(receipt._id), status: 'paid' }
                  payments.push(p)
                  alloc.payments = payments
                  alloc.paid = true
                  await alloc.save()
                  console.log('Updated allocation as paid', alloc._id)
                }
              } catch (e) { console.warn('Failed to update transport allocation payments on confirm', e && e.message) }

              return res.json({ ok: true, receipt })
            } catch (e) { return res.status(500).json({ message: e.message }) }
          }
        }
      } catch (e) { console.warn('Failed handling transport fee processing', e && e.message) }

      // if not returned earlier (e.g. no immediate pay-now flow), respond with created allocation
      return res.json(doc)
    } catch (e) { return res.status(500).json({ message: e.message }) }
  });

  // Student: list their allocations
  app.get('/api/transport/allocations/my', verifyToken, async (req, res) => {
    try {
      const userId = req.user && req.user.sub
      const username = req.user && req.user.username
      const filter = {}
      if (userId) filter['student.id'] = userId
      else if (username) filter['student.email'] = username
      const list = await TransportAllocation.find(filter).sort({ createdAt: -1 }).lean().catch(() => [])
      return res.json(list)
    } catch (e) { return res.status(500).json({ message: e.message }) }
  });

  // Student: get their transport receipts
  app.get('/api/transport/receipts/my', verifyToken, async (req, res) => {
    try {
      const username = req.user && req.user.username
      const filter = {}
      if (username) filter.studentEmail = username
      const items = await TransportReceipt.find(filter).sort({ createdAt: -1 }).lean().catch(() => [])
      return res.json(items)
    } catch (e) { return res.status(500).json({ message: e.message }) }
  });
}
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const mongoose = require('mongoose')
const helmet = require('helmet')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')
const User = require('./models/User')
const Complaint = require('./models/Complaint')
const Event = require('./models/Event')
const Syllabus = require('./models/Syllabus')
const Leave = require('./models/Leave')
const Message = require('./models/Message')
const Student = require('./models/Student')
const Faculty = require('./models/Faculty')
const ContactQuery = require('./models/ContactQuery')
const DeletionRequest = require('./models/DeletionRequest')
const Meeting = require('./models/Meeting')
const FeeStructure = require('./models/FeeStructure')
const Receipt = require('./models/Receipt')
const ReportCard = require('./models/ReportCard')
const Assignment = require('./models/Assignment')
const Submission = require('./models/Submission')
const Timetable = require('./models/Timetable')
const FacultyRegistration = require('./models/FacultyRegistration')
const StudentRegistration = require('./models/StudentRegistration')
const PasswordReset = require('./models/PasswordReset')
const Attendance = require('./models/Attendance')
const FacultyAttendance = require('./models/FacultyAttendance')
const StaffAttendance = require('./models/StaffAttendance')
const Mark = require('./models/Mark')
const Notice = require('./models/Notice')
const Resource = require('./models/Resource')
const TestSeries = require('./models/TestSeries')
const ClassModel = require('./models/Class')
const TestResult = require('./models/TestResult')
const Question = require('./models/Question')
const SalaryPayment = require('./models/SalaryPayment')
const StaffSalaryPayment = require('./models/StaffSalaryPayment')
const IDCard = require('./models/IDCard')
const HostelAllocation = require('./models/HostelAllocation')
const Hostel = require('./models/Hostel')

const FrontOffice = require('./models/FrontOffice')
const AdmissionEnquiry = require('./models/AdmissionEnquiry')
const OnlineAdmission = require('./models/OnlineAdmission')
const Discount = require('./models/Discount')

const { normalizeText, levenshtein, similarity, enhancedSimilarity } = require('./utils/similarity')
const { users: demoUsers, findByUsername } = require('./users')
const { verifyToken, requireRole } = require('./middleware/auth')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 4000
// Allow configuring maximum JSON/body size to avoid PayloadTooLargeError.
// Use `JSON_BODY_LIMIT` (e.g. "10mb" or numeric bytes) or fall back to
// `MAX_JSON_BODY_BYTES` for backward compatibility, otherwise default to 10mb.
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || process.env.MAX_JSON_BODY_BYTES || '10mb'
// Subjective grading configuration
const SUBJECTIVE_THRESHOLD = Number(process.env.SUBJECTIVE_THRESHOLD || 0.7)
const SUBJECTIVE_SCORING = process.env.SUBJECTIVE_SCORING || 'proportional' // 'proportional' or 'binary'
const DEBUG_MATCH_THRESHOLD = Number(process.env.DEBUG_MATCH_THRESHOLD || 40) // percent under which to return raw block for debug
const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set. Please set MONGODB_URI in your environment or .env (no hardcoded defaults).')
  process.exit(1)
}
const JWT_SECRET = process.env.JWT_SECRET
if (process.env.NODE_ENV === 'production') {
  if (!JWT_SECRET || JWT_SECRET === 'change-this-secret') {
    console.error('FATAL ERROR: JWT_SECRET is missing or set to insecure default "change-this-secret" in production. Exiting process.')
    process.exit(1)
  }
}
const FRONTEND_DIST = process.env.FRONTEND_DIST || path.join(__dirname, '..', 'frontend', 'dist')
// Try to setup Razorpay if env provided (optional)
let Razorpay = null
let razorpayClient = null
try { Razorpay = require('razorpay') } catch (e) { Razorpay = null }
if (Razorpay && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  try { razorpayClient = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET }) } catch (e) { razorpayClient = null }
}

// Configure CORS: allow specific origins via `ALLOWED_ORIGINS` (comma-separated)
// Fallback: use `FRONTEND_URL` or `VITE_FRONTEND_URL`. In development you can set
// `ALLOW_ALL_ORIGINS=true` to allow all origins (convenient for local testing).
const allowedEnv = process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || ''
const allowAll = String(process.env.ALLOW_ALL_ORIGINS || process.env.DEV_ALLOW_ALL || '').toLowerCase() === 'true'
let corsOptions = undefined
{
  // Default development origins to allow (helps when FRONTEND_URL not set)
  const defaultDevOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ]

  // If explicitly asked, allow all origins (development only if not production)
  if (allowAll || (process.env.NODE_ENV !== 'production' && !allowedEnv)) {
    console.warn('CORS: permissive mode enabled (allowing all origins)')
    corsOptions = { origin: true, credentials: true }
  } else {
    // Normalize configured origins by trimming whitespace and trailing slashes
    const origins = allowedEnv ? allowedEnv.split(',').map(s => String(s || '').trim()).filter(Boolean) : defaultDevOrigins
    const normalizedOrigins = origins.map(o => o.replace(/\/+$/, ''))
    corsOptions = {
      origin: function (origin, cb) {
        // allow requests with no origin (curl, mobile apps, server-to-server)
        if (!origin) return cb(null, true)
        
        // If strict origins are not configured, allow all to prevent breaking Vercel deployments
        if (!allowedEnv) return cb(null, true)

        try {
          const norm = String(origin || '').replace(/\/+$/, '')
          if (normalizedOrigins.indexOf(norm) !== -1) return cb(null, true)
        } catch (e) {
          // fallthrough to deny
        }
        console.warn(`CORS: Denying request from unconfigured origin: ${origin}`)
        return cb(null, false) // Return false instead of Error to prevent 500 Internal Server Error
      },
      credentials: true,
    }
    console.log('CORS: strict origins mode enabled:', normalizedOrigins.join(', '))
  }
}
app.use(cors(corsOptions))
// When running behind a proxy (Render, etc.) enable trust proxy so req.ip and secure checks work correctly
app.set('trust proxy', true)

// Production-grade security headers
app.use(helmet({
  contentSecurityPolicy: false,
}))
app.disable('x-powered-by')

// Request logging using morgan
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'))
} else {
  app.use(morgan('dev'))
}

// Rate Limiting setup
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP, please try again after 15 minutes.' }
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // Limit each IP to 30 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts from this IP, please try again after 15 minutes.' }
})

app.use('/api/login', authLimiter)
app.use('/api', (req, res, next) => {
  // Exclude SSE Stream endpoint to keep connections open
  if (req.path === '/notifications/stream') return next()
  return apiLimiter(req, res, next)
})

// Configure body parsers with an increased, configurable limit to prevent
// "PayloadTooLargeError: request entity too large" on large JSON payloads.
app.use(express.json({ limit: JSON_BODY_LIMIT }))
app.use(express.urlencoded({ limit: JSON_BODY_LIMIT, extended: true }))
// serve uploaded files
const uploadsDir = path.join(__dirname, 'uploads')
app.use('/uploads', express.static(uploadsDir))


// Register transport routes (defined earlier) after app and middleware are initialized
try { registerTransportRoutes && registerTransportRoutes() } catch (e) { console.warn('Failed to register transport routes', e && e.message) }
// Register report card routes
try {
  // List current user's report cards
  app.get('/api/reportcards/my', verifyToken, async (req, res) => {
    try {
      const username = req.user && req.user.username
      const userId = req.user && req.user.sub
      const filter = { $or: [] }
      if (userId) filter.$or.push({ recipientId: userId })
      if (username) filter.$or.push({ recipientEmail: { $regex: new RegExp('^' + username + '$', 'i') } })
      // If this user is a student, also attempt to find the Student document and match by its id
      try {
        if (username) {
          const stud = await Student.findOne({ email: username }).lean().catch(() => null)
          if (stud && stud._id) filter.$or.push({ recipientId: String(stud._id) })
        }
      } catch (e) { /* ignore */ }
      // If no filters could be assembled, return empty
      if (!filter.$or || filter.$or.length === 0) return res.json([])
      const list = await ReportCard.find(filter).sort({ createdAt: -1 }).lean().catch(() => [])
      return res.json(list || [])
    } catch (e) { return res.status(500).json({ message: e.message }) }
  })

  // Download a specific report card file (streamed with auth)
  app.get('/api/reportcards/:id/download', verifyToken, async (req, res) => {
    try {
      const id = req.params && req.params.id
      if (!id) return res.status(400).json({ message: 'id required' })
      const rc = await ReportCard.findById(id).lean().catch(() => null)
      if (!rc) return res.status(404).json({ message: 'Report card not found' })
      // Authorization: allow owner by email or id, or admin/faculty roles
      try {
        const user = req.user || {}
        const isOwnerById = user.sub && String(user.sub) === String(rc.recipientId)
        const isOwnerByEmail = user.username && String(user.username).toLowerCase() === String(rc.recipientEmail || '').toLowerCase()
        const isPrivileged = (user && user.role && (
          String(user.role) === 'admin' ||
          String(user.role) === 'faculty' ||
          (Array.isArray(user.roles) && (user.roles.includes('admin') || user.roles.includes('faculty')))
        ))
        if (!isOwnerById && !isOwnerByEmail && !isPrivileged) return res.status(403).json({ message: 'Forbidden' })
      } catch (e) { /* fallthrough to forbidden */ }

      // If a remote URL is provided, proxy the file
      if (rc.filePath && String(rc.filePath).toLowerCase().startsWith('http')) {
        // Simple proxy: fetch remote URL and pipe
        try {
          const fetch = require('node-fetch')
          const remote = String(rc.filePath)
          const rres = await fetch(remote)
          if (!rres.ok) return res.status(502).json({ message: 'Failed to fetch remote file' })
          res.setHeader('Content-Type', rc.mime || 'application/octet-stream')
          const fname = (remote.split('/').pop() || `report_${id}.pdf`)
          res.setHeader('Content-Disposition', `attachment; filename="${fname}"`)
          rres.body.pipe(res)
          return
        } catch (e) { console.warn('Remote proxy failed', e); return res.status(500).json({ message: 'Failed to proxy remote file' }) }
      }

      if (!rc.filePath) return res.status(404).json({ message: 'No file available for this report card' })
      // Resolve local path (strip leading slashes)
      const rel = String(rc.filePath).replace(/^\/+/, '')
      const full = path.join(__dirname, rel)
      // Ensure file exists
      const fs = require('fs')
      if (!fs.existsSync(full)) return res.status(404).json({ message: 'File not found on server' })
      const filename = (rel.split('/').pop()) || `report_${id}.pdf`
      res.setHeader('Content-Type', rc.mime || 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      return res.sendFile(full)
    } catch (e) { console.error('Report card download failed', e); return res.status(500).json({ message: e.message }) }
  })
} catch (e) { console.warn('Failed to register reportcard routes', e && e.message) }
// Register admit card routes (modular)
try {
  const registerAdmitCardRoutes = require('./routes/admitcards')
  // provide dependencies to the module for consistency
  registerAdmitCardRoutes && registerAdmitCardRoutes(app, { uploadsDir, Student, User, AdmitCard: require('./models/AdmitCard'), PDFDocument: PDFDocument })
} catch (e) { console.warn('Failed to register admit card routes', e && e.message) }

// multer for file uploads (assignments/submissions)
const multer = require('multer')
const fs = require('fs')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadsDir) },
  filename: function (req, file, cb) { const name = Date.now() + '_' + file.originalname.replace(/\s+/g, '_'); cb(null, name) }
})
// Allow uploads up to 1GB (useful for large video resources). Keep storage configuration.
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES) || (1024 * 1024 * 1024) // 1GB
const upload = multer({ storage, limits: { fileSize: MAX_UPLOAD_BYTES } })

// === Assignments & Submissions routes ===
try {
  // List assignments (any authenticated user can read)
  app.get('/api/assignments', verifyToken, async (req, res) => {
    try {
      const q = {}
      const { class: cls, section } = req.query || {}
      if (cls) q.class = String(cls)
      if (section) q.section = String(section)
      const items = await Assignment.find(q).sort({ createdAt: -1 }).lean().catch(() => [])
      return res.json(items)
    } catch (e) { return res.status(500).json({ message: e.message }) }
  })

  // Create assignment (faculty or admin)
  app.post('/api/assignments', verifyToken, requireRole(['admin','faculty']), upload.single('file'), async (req, res) => {
    try {
      if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
      const body = req.body || {}
      if (!body.title || !body.class) return res.status(400).json({ message: 'title and class required' })
      const file = req.file
      const filePath = file ? `/uploads/${file.filename}` : ''
      const doc = await Assignment.create({
        title: String(body.title || ''),
        description: String(body.description || ''),
        subject: String(body.subject || ''),
        class: String(body.class || ''),
        section: body.section || 'ALL',
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        filePath,
        createdBy: req.user && req.user.sub
      })
      return res.status(201).json(doc)
    } catch (e) { return res.status(500).json({ message: e.message }) }
  })

  // Student: submit an assignment (optional file). Reject if past due date.
  app.post('/api/assignments/:id/submit', verifyToken, requireRole('student'), upload.single('file'), async (req, res) => {
    try {
      if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
      const aid = req.params.id
      const assignment = await Assignment.findById(aid).lean().catch(() => null)
      if (!assignment) return res.status(404).json({ message: 'Assignment not found' })
      // Check due date: if present and now > dueDate, reject submission
      if (assignment.dueDate) {
        const now = new Date()
        const due = new Date(assignment.dueDate)
        if (now > due) return res.status(403).json({ message: 'Submission window closed: assignment due date passed' })
      }
      const username = req.user && req.user.username
      const studentRec = await Student.findOne({ email: username }).lean().catch(() => null)
      const file = req.file
      const filePath = file ? `/uploads/${file.filename}` : (req.body && req.body.filePath ? String(req.body.filePath) : '')
      const sub = await Submission.create({
        assignmentId: aid,
        studentId: studentRec ? studentRec._id : undefined,
        studentName: studentRec ? studentRec.name : (req.body && req.body.studentName) || '',
        studentRoll: studentRec ? studentRec.rollNo : (req.body && req.body.studentRoll) || '',
        studentClass: studentRec ? studentRec.class : (req.body && req.body.studentClass) || '',
        studentEmail: username || (req.body && req.body.studentEmail) || '',
        answerText: req.body && req.body.answerText ? String(req.body.answerText) : '',
        filePath,
        submittedAt: new Date()
      })
      return res.status(201).json(sub)
    } catch (e) { return res.status(500).json({ message: e.message }) }
  })

  // List submissions for an assignment. Students see only their own; parents need studentId; faculty/admin see all.
  app.get('/api/assignments/:id/submissions', verifyToken, async (req, res) => {
    try {
      if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
      const aid = req.params.id
      const role = req.user && req.user.role
      const username = req.user && req.user.username
      const q = { assignmentId: aid }
      if (role === 'student') {
        q.studentEmail = username
      } else if (role === 'parent') {
        const { studentId } = req.query || {}
        if (!studentId) return res.status(400).json({ message: 'studentId required for parent' })
        const user = await User.findById(req.user.sub).lean().catch(() => null)
        if (!user || user.role !== 'parent') return res.status(403).json({ message: 'Unauthorized' })
        const allowed = Array.isArray(user.parentOf) && user.parentOf.some(x => String(x) === String(studentId))
        if (!allowed) return res.status(403).json({ message: 'Not linked to this student' })
        q.studentId = studentId
      }
      const subs = await Submission.find(q).sort({ createdAt: -1 }).lean().catch(() => [])
      return res.json(subs)
    } catch (e) { return res.status(500).json({ message: e.message }) }
  })
} catch (e) { console.warn('Failed to register assignments routes', e && e.message) }


// Contact Query endpoints (moved after multer/upload initialization)
// Public: submit a contact query (optionally attach a PDF under the configured upload limits)
app.post('/api/contact-query', upload.single('attachment'), async (req, res) => {
  try {
    const { name, email, contact, description } = req.body || {}
    if (!name || !email || !contact || !description) return res.status(400).json({ message: 'name, email, contact and description are required' })
    if ((description || '').length > 10000) return res.status(400).json({ message: 'description too long' })

    const doc = await ContactQuery.create({
      name: String(name).trim(),
      email: String(email).trim(),
      contact: String(contact).trim(),
      description: String(description).trim(),
      filename: req.file && req.file.filename ? req.file.filename : undefined,
      originalname: req.file && req.file.originalname ? req.file.originalname : undefined,
      createdBy: req.user && req.user.sub ? req.user.sub : undefined
    })

    // Return saved object
    return res.json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: list contact queries
app.get('/api/admin/contact-queries', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await ContactQuery.find({}).sort({ createdAt: -1 }).lean().catch(() => [])
    // Attach URL for downloads
    const out = (list || []).map(it => ({ ...it, url: it.filename ? `/uploads/${it.filename}` : undefined }))
    return res.json(out)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: update status and optionally add a note and mark notified
app.patch('/api/admin/contact-queries/:id/status', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const id = req.params.id
    const { status, notify, note } = req.body || {}
    if (!id) return res.status(400).json({ message: 'id required' })
    const doc = await ContactQuery.findById(id)
    if (!doc) return res.status(404).json({ message: 'not found' })
    if (status) doc.status = status
    if (note) {
      doc.notes = doc.notes || []
      doc.notes.push({ text: String(note || ''), author: req.user && req.user.sub ? req.user.sub : null })
      // also set a top-level note for compatibility with older frontend usages
      doc.note = String(note || '')
    }
    if (notify) doc.notified = true
    await doc.save()

    // Return updated document (lean-like)
    const out = (await ContactQuery.findById(id).lean()) || {}
    out.url = out.filename ? `/uploads/${out.filename}` : undefined
    return res.json(out)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: update faculty fields (accept assignments, houses, role)
app.put('/api/faculty/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const id = req.params.id
    const payload = req.body || {}
    const allowed = ['name', 'email', 'contact', 'experience', 'employeeId', 'subject', 'avatar', 'classGrade', 'assignments', 'houses', 'role']
    const update = {}
    for (const k of allowed) { if (payload[k] !== undefined) update[k] = payload[k] }
    const doc = await Faculty.findByIdAndUpdate(id, update, { new: true }).lean().catch(() => null)
    if (!doc) return res.status(404).json({ message: 'not found' })
    return res.json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Faculty dashboard - small summary for faculty (used by frontend to populate panel)
app.get('/api/faculty/dashboard', verifyToken, requireRole(['faculty','admin']), async (req, res) => {
  try {
    const userId = req.user && req.user.sub
    const username = req.user && req.user.username
    let fac = null
    try {
      if (userId) fac = await Faculty.findOne({ $or: [{ userId: userId }, { _id: userId }] }).lean().catch(() => null)
      if (!fac && username) fac = await Faculty.findOne({ $or: [{ email: username }, { employeeId: username }] }).lean().catch(() => null)
    } catch (e) { fac = null }

    // Count upcoming meetings linked to this faculty (if any)
    let upcomingMeetings = 0
    try {
      if (fac && fac._id) {
        upcomingMeetings = await Meeting.countDocuments({ facultyId: String(fac._id), date: { $gte: new Date() } }).catch(() => 0)
      }
    } catch (e) { upcomingMeetings = 0 }

    // Normalize assigned classes into an array of class identifiers
    let assignedClasses = []
    try {
      if (fac) {
        if (Array.isArray(fac.classGrade)) assignedClasses = fac.classGrade.map(x => String(x)).filter(Boolean)
        else if (typeof fac.classGrade === 'string' && fac.classGrade.trim()) assignedClasses = [fac.classGrade.trim()]
        else if (Array.isArray(fac.assignments) && fac.assignments.length) assignedClasses = fac.assignments.map(a => String(a)).filter(Boolean)
      }
    } catch (e) { assignedClasses = [] }

    // Count students in those assigned classes (real-time)
    let assignedStudentsCount = 0
    try {
      if (assignedClasses.length > 0) {
        assignedStudentsCount = await Student.countDocuments({ class: { $in: assignedClasses } }).catch(() => 0)
      }
    } catch (e) { assignedStudentsCount = 0 }

    const summary = {
      faculty: fac ? { _id: fac._id, name: fac.name, email: fac.email, subject: fac.subject, classGrade: fac.classGrade } : null,
      upcomingMeetings: Number(upcomingMeetings) || 0,
      assignedClasses: assignedClasses,
      assignedClassesCount: assignedClasses.length,
      assignedStudentsCount: Number(assignedStudentsCount) || 0
    }
    return res.json(summary)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Faculty Attendance APIs
app.get('/api/faculty-attendance', verifyToken, async (req, res) => {
  try {
    const { date, from, to, facultyId } = req.query || {}
    const filter = {}
    if (date) filter.date = date
    if (from && to) filter.date = { $gte: from, $lte: to }
    const list = await FacultyAttendance.find(filter).lean().catch(() => [])
    const narrowed = facultyId ? list.map(d => ({ ...d, records: (Array.isArray(d.records) ? d.records.filter(r => String(r.facultyId) === String(facultyId)) : []) })) : list
    return res.json(narrowed)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.post('/api/faculty-attendance', verifyToken, requireRole('admin|faculty'), async (req, res) => {
  try {
    const { date, records } = req.body || {}
    if (!date || !Array.isArray(records) || records.length === 0) return res.status(400).json({ message: 'date and records required' })
    let doc = await FacultyAttendance.findOne({ date }).catch(() => null)
    if (!doc) doc = await FacultyAttendance.create({ date, records: [], createdBy: req.user.sub })
    for (const rec of records) {
      const idx = Array.isArray(doc.records) ? doc.records.findIndex(r => String(r.facultyId) === String(rec.facultyId)) : -1
      const payload = { facultyId: rec.facultyId, status: rec.status || 'present', markedBy: req.user.sub }
      if (idx >= 0) doc.records[idx] = payload; else doc.records.push(payload)
    }
    await doc.save()
    return res.json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// CSV export for faculty attendance
app.get('/api/attendance/faculty/export', verifyToken, async (req, res) => {
  try {
    const { from, to, facultyId } = req.query || {}
    const filter = {}
    if (from && to) filter.date = { $gte: from, $lte: to }
    const list = await FacultyAttendance.find(filter).lean().catch(() => [])
    const rows = []
    rows.push(['Date', 'Faculty', 'EmployeeId', 'Status'])
    for (const d of list) {
      const recs = Array.isArray(d.records) ? d.records : []
      for (const r of recs) {
        if (facultyId && String(r.facultyId) !== String(facultyId)) continue
        let fac = null
        try { fac = await Faculty.findById(r.facultyId).lean().catch(() => null) } catch {}
        rows.push([d.date, fac ? fac.name : String(r.facultyId), fac ? (fac.employeeId || '') : '', r.status || ''])
      }
    }
    const csv = rows.map(row => row.map(v => String(v).replace(/"/g, '""')).map(v => /[",\n]/.test(v) ? `"${v}"` : v).join(',')).join('\n')
    const fname = `faculty_attendance_${from || 'start'}_${to || 'end'}.csv`
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`)
    return res.send(csv)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Student deletion requests (admin): list and approve
app.get('/api/students/delete-requests', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await DeletionRequest.find({}).sort({ createdAt: -1 }).lean().catch(() => [])
    return res.json(list || [])
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.put('/api/students/delete-requests/:id/approve', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const id = req.params && req.params.id
    if (!id) return res.status(400).json({ message: 'id required' })
    const reqDoc = await DeletionRequest.findById(id).lean().catch(() => null)
    if (!reqDoc) return res.status(404).json({ message: 'Request not found' })

    // delete student record if present
    try {
      if (reqDoc.studentId) {
        await Student.findByIdAndDelete(reqDoc.studentId).catch(() => null)
      }
    } catch (e) { /* ignore */ }

    // delete associated user account by email if exists
    try {
      if (reqDoc.studentEmail) {
        await User.findOneAndDelete({ username: reqDoc.studentEmail }).catch(() => null)
      }
    } catch (e) { /* ignore */ }

    // remove the deletion request document
    try { await DeletionRequest.findByIdAndDelete(id).catch(() => null) } catch (e) { /* ignore */ }

    return res.json({ ok: true, message: 'Student deleted and request removed' })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Create a report card (admin/faculty)
app.post('/api/reportcards', verifyToken, requireRole(['admin','faculty']), upload.single('signature'), async (req, res) => {
  try {
    const payload = req.body || {}
    const { schoolName = '', examName = '', className = '', section = '', recipientName = '', recipientEmail = '', rollNumber = '', templateType = 'normal', subjects = [] } = payload
    // basic validation
    if (!recipientEmail && !recipientName) return res.status(400).json({ message: 'recipientName or recipientEmail required' })

    // create a DB document; file generation (PDF) will be attempted and filePath set if successful
    const doc = await ReportCard.create({ schoolName, examName, className, section, recipientName, recipientEmail, rollNumber, templateType, subjects, createdBy: req.user && req.user.sub })

    // handle signature upload (if provided)
    if (req.file && req.file.filename) {
      try {
        const sigF = req.file.filename
        const sigPath = `/uploads/${sigF}`
        await ReportCard.findByIdAndUpdate(doc._id, { signaturePath: sigPath }).catch(() => null)
        // update doc object for immediate PDF generation
        doc.signaturePath = sigPath
      } catch (e) { console.warn('Failed to save signature path', e && e.message) }
    }

    // Try to generate a simple PDF using pdfkit if available
    try {
      if (PDFDocument) {
        const fname = `${Date.now()}_report_${String(doc._id).slice(-6)}.pdf`
        const outPath = path.join(uploadsDir, fname)
        const stream = fs.createWriteStream(outPath)
        const pdf = new PDFDocument({ size: 'A4', margin: 40 })
        pdf.pipe(stream)
        // Header
        pdf.rect(0, 0, pdf.page.width, 90).fill('#0B5FFF')
        pdf.fillColor('white').fontSize(20).text(String(schoolName || 'School Name'), 50, 24)
        pdf.fontSize(12).text(String(examName || ''), 50, 48)
        pdf.restore()
        pdf.moveDown(2)
        pdf.fillColor('#000').fontSize(12)
        pdf.text(`Name: ${recipientName || ''}`)
        pdf.text(`Class: ${className || ''}    Section: ${section || ''}    Roll No: ${rollNumber || ''}`)
        pdf.moveDown(1)
        pdf.text('Subjects', { underline: true })
        let totalObt = 0, totalMax = 0
        subjects.forEach((s, idx) => {
          const m = Number(s.marks || 0)
          const mm = Number(s.maxMarks || 0) || 100
          totalObt += m
          totalMax += mm
          pdf.text(`${idx + 1}. ${s.name || ''} — ${m} / ${mm}`)
        })
        const perc = totalMax ? Math.round((totalObt / totalMax) * 100 * 100) / 100 : 0
        pdf.moveDown(1)
        pdf.text(`Total: ${totalObt} / ${totalMax}`)
        pdf.text(`Percentage: ${perc}%`)
        // attach signature image if available
        try {
          if (doc.signaturePath) {
            const sigFile = String(doc.signaturePath || '').replace(/^\/uploads\//, '')
            const sigAbs = path.join(uploadsDir, sigFile)
            if (fs.existsSync(sigAbs)) {
              const sigWidth = 160
              const sigX = pdf.page.width - 60 - sigWidth
              const sigY = pdf.y
              pdf.image(sigAbs, sigX, sigY, { width: sigWidth })
              pdf.moveDown(6)
            }
          }
        } catch (e) { /* ignore signature embed errors */ }
        pdf.moveDown(4)
        pdf.text('Controller Signature:', { align: 'right' })
        pdf.end()
        await new Promise((resolve) => stream.on('finish', resolve))
        doc.filePath = `/uploads/${fname}`
        doc.mime = 'application/pdf'
        await doc.save()
        
        try {
          const s = await Student.findOne({ email: recipientEmail }).lean()
          const phone = s ? s.contact : null
          await notifyEvent({
            event: 'exam_result',
            phone,
            message: `Report card generated for ${examName}. View on portal.`,
            emailOpts: { to: recipientEmail, subject: `Report Card: ${examName}`, text: `Your report card for ${examName} is available.` }
          })
        } catch(e){}
      }
    } catch (e) {
      console.warn('Failed to generate report card PDF', e && e.message)
    }

    return res.status(201).json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// List all report cards (admin)
app.get('/api/reportcards', verifyToken, requireRole(['admin','faculty']), async (req, res) => {
  try {
    const list = await ReportCard.find({}).sort({ createdAt: -1 }).lean().catch(() => [])
    return res.json(list)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// List report cards for current user (student)
app.get('/api/reportcards/my', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const userId = req.user && req.user.sub
    if (!userId) return res.status(401).json({ message: 'Not authenticated' })
    const list = await ReportCard.find({ recipientEmail: req.user.username }).sort({ createdAt: -1 }).lean().catch(() => [])
    return res.json(list)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Parent/Admin/Student: list report cards for a specific student
app.get('/api/reportcards/by-student/:id', verifyToken, requireRole(['student','parent','admin','faculty']), async (req, res) => {
  try {
    const id = req.params.id
    if (!id) return res.status(400).json({ message: 'student id required' })
    const student = await Student.findById(id).lean().catch(() => null)
    if (!student) return res.status(404).json({ message: 'Student not found' })

    if (req.user.role === 'parent') {
      const parent = await User.findById(req.user.sub).lean().catch(() => null)
      const linked = parent && Array.isArray(parent.parentOf) && parent.parentOf.some(x => String(x) === String(id))
      if (!linked) return res.status(403).json({ message: 'Parent is not linked to this student' })
    }
    if (req.user.role === 'student' && String(req.user.username || '').toLowerCase() !== String(student.email || '').toLowerCase()) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const list = await ReportCard.find({
      $or: [
        { recipientEmail: student.email },
        { recipientId: student._id },
        { recipientName: student.name, className: student.class, section: student.section },
        { rollNumber: student.rollNo, className: student.class, section: student.section }
      ]
    }).sort({ createdAt: -1 }).lean().catch(() => [])
    return res.json(list)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Student/Parent/Admin: rank summary for one student within class-section
app.get('/api/progress/rank/:id', verifyToken, requireRole(['student','parent','admin','faculty']), async (req, res) => {
  try {
    const id = req.params.id
    if (!id) return res.status(400).json({ message: 'student id required' })
    const student = await Student.findById(id).lean().catch(() => null)
    if (!student) return res.status(404).json({ message: 'Student not found' })

    if (req.user.role === 'parent') {
      const parent = await User.findById(req.user.sub).lean().catch(() => null)
      const linked = parent && Array.isArray(parent.parentOf) && parent.parentOf.some(x => String(x) === String(id))
      if (!linked) return res.status(403).json({ message: 'Parent is not linked to this student' })
    }
    if (req.user.role === 'student' && String(req.user.username || '').toLowerCase() !== String(student.email || '').toLowerCase()) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const students = await Student.find({ class: student.class, section: student.section }).lean().catch(() => [])
    const rows = []
    for (const s of students) {
      const tests = await TestResult.find({ $or: [{ studentId: s._id }, { email: s.email }] }).lean().catch(() => [])
      const cards = await ReportCard.find({
        $or: [
          { recipientEmail: s.email },
          { recipientId: s._id },
          { rollNumber: s.rollNo, className: s.class, section: s.section }
        ]
      }).lean().catch(() => [])

      const reportPercentages = cards.map(c => Number(c.percentage)).filter(n => Number.isFinite(n) && n > 0)
      const testPercentages = tests.map(t => {
        if (Number.isFinite(Number(t.percentage))) return Number(t.percentage)
        if (Number(t.total) > 0) return (Number(t.score || 0) / Number(t.total)) * 100
        return null
      }).filter(n => Number.isFinite(n))
      const scores = reportPercentages.length ? reportPercentages : testPercentages
      const avg = scores.length ? scores.reduce((sum, n) => sum + n, 0) / scores.length : null
      rows.push({ studentId: String(s._id), name: s.name, rollNo: s.rollNo, avg: avg == null ? null : Number(avg.toFixed(2)), count: scores.length })
    }

    rows.sort((a, b) => {
      const aa = typeof a.avg === 'number' ? a.avg : -Infinity
      const bb = typeof b.avg === 'number' ? b.avg : -Infinity
      if (aa !== bb) return bb - aa
      return String(a.name || '').localeCompare(String(b.name || ''))
    })
    const index = rows.findIndex(r => String(r.studentId) === String(id))
    const row = index >= 0 ? rows[index] : null
    return res.json({ rank: index >= 0 ? index + 1 : null, totalStudents: rows.length, class: student.class, section: student.section, average: row ? row.avg : null, recordsCount: row ? row.count : 0 })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Download report card file
app.get('/api/reportcards/:id/download', verifyToken, async (req, res) => {
  try {
    const id = req.params.id
    if (!id) return res.status(400).json({ message: 'id required' })
    const doc = await ReportCard.findById(id).lean().catch(() => null)
    if (!doc || !doc.filePath) return res.status(404).json({ message: 'File not found' })
    const fp = String(doc.filePath || '').replace(/^\//, '')
    const filename = path.basename(fp)
    let abs = path.join(uploadsDir, filename)

    // If file missing or filePath empty, attempt to generate PDF on-demand (and save reference)
    if (!doc.filePath || !fs.existsSync(abs)) {
      if (!PDFDocument) return res.status(404).json({ message: 'File missing on server and PDF generator not available' })
      try {
        // generate a PDF from the saved doc data
        const fname = `${Date.now()}_report_${String(id).slice(-6)}.pdf`
        abs = path.join(uploadsDir, fname)
        const stream = fs.createWriteStream(abs)
        const pdf = new PDFDocument({ size: 'A4', margin: 40 })
        pdf.pipe(stream)
        pdf.rect(0, 0, pdf.page.width, 90).fill('#0B5FFF')
        pdf.fillColor('white').fontSize(20).text(String(doc.schoolName || 'School Name'), 50, 24)
        pdf.fontSize(12).text(String(doc.examName || ''), 50, 48)
        pdf.restore()
        pdf.moveDown(2)
        pdf.fillColor('#000').fontSize(12)
        pdf.text(`Name: ${doc.recipientName || ''}`)
        pdf.text(`Class: ${doc.className || ''}    Section: ${doc.section || ''}    Roll No: ${doc.rollNumber || ''}`)
        pdf.moveDown(1)
        pdf.text('Subjects', { underline: true })
        let totalObt = 0, totalMax = 0
        (doc.subjects || []).forEach((s, idx) => {
          const m = Number(s.marks || 0)
          const mm = Number(s.maxMarks || 0) || 100
          totalObt += m
          totalMax += mm
          pdf.text(`${idx + 1}. ${s.name || ''} — ${m} / ${mm}`)
        })
        const perc = totalMax ? Math.round((totalObt / totalMax) * 100 * 100) / 100 : 0
        pdf.moveDown(1)
        pdf.text(`Total: ${totalObt} / ${totalMax}`)
        pdf.text(`Percentage: ${perc}%`)
        pdf.moveDown(4)
        pdf.text('Controller Signature:', { align: 'right' })
        pdf.end()
        await new Promise((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject) })

        // update DB document with filePath
        try {
          await ReportCard.findByIdAndUpdate(id, { filePath: `/uploads/${fname}`, mime: 'application/pdf' }).catch(() => null)
        } catch (e) { console.warn('Failed to update reportcard doc with filePath', e && e.message) }
      } catch (e) {
        console.warn('Failed to generate reportcard PDF on-demand', e && e.message)
        return res.status(500).json({ message: 'Failed to generate PDF' })
      }
    }

    return res.download(abs, filename, (err) => { if (err) console.warn('Failed to send reportcard file', err && err.message) })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})
// Staff Attendance APIs
app.get('/api/attendance/staff', verifyToken, async (req, res) => {
  try {
    const { date, from, to, userId } = req.query || {}
    const filter = {}
    if (date) filter.date = date
    if (from && to) filter.date = { $gte: from, $lte: to }
    const list = await StaffAttendance.find(filter).lean().catch(() => [])
    const narrowed = userId ? list.map(d => ({ ...d, records: (Array.isArray(d.records) ? d.records.filter(r => String(r.userId) === String(userId)) : []) })) : list
    return res.json(narrowed)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.post('/api/attendance/staff', verifyToken, requireRole(['admin','staff']), async (req, res) => {
  try {
    const { date, records } = req.body || {}
    if (!date || !Array.isArray(records) || records.length === 0) return res.status(400).json({ message: 'date and records required' })
    let doc = await StaffAttendance.findOne({ date }).catch(() => null)
    if (!doc) doc = await StaffAttendance.create({ date, records: [], createdBy: req.user.sub })
    for (const rec of records) {
      const idx = Array.isArray(doc.records) ? doc.records.findIndex(r => String(r.userId) === String(rec.userId)) : -1
      const payload = { userId: rec.userId, status: rec.status || 'present', markedBy: req.user.sub }
      if (idx >= 0) doc.records[idx] = payload; else doc.records.push(payload)
    }
    await doc.save()
    return res.json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// CSV export for staff attendance
app.get('/api/attendance/staff/export', verifyToken, async (req, res) => {
  try {
    const { from, to, userId } = req.query || {}
    const filter = {}
    if (from && to) filter.date = { $gte: from, $lte: to }
    const list = await StaffAttendance.find(filter).lean().catch(() => [])
    const rows = []
    rows.push(['Date', 'Staff', 'StaffId', 'Status'])
    for (const d of list) {
      const recs = Array.isArray(d.records) ? d.records : []
      for (const r of recs) {
        if (userId && String(r.userId) !== String(userId)) continue
        let u = null
        try { u = await User.findById(r.userId).lean().catch(() => null) } catch {}
        const staffId = u ? `STF-${String(u._id).slice(-6).toUpperCase()}` : ''
        rows.push([d.date, u ? (u.name || u.username) : String(r.userId), staffId, r.status || ''])
      }
    }
    const csv = rows.map(row => row.map(v => String(v).replace(/"/g, '""')).map(v => /[",\n]/.test(v) ? `"${v}"` : v).join(',')).join('\n')
    const fname = `staff_attendance_${from || 'start'}_${to || 'end'}.csv`
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`)
    return res.send(csv)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})


// Hostel Allocation APIs
// List allocations (optionally filter by studentId or hostelId)
app.get('/api/hostel/allocations', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { studentId, hostelId } = req.query || {}
    const filter = {}
    if (studentId) filter['student.id'] = studentId
    if (hostelId) filter.hostelId = hostelId
    const list = await HostelAllocation.find(filter).sort({ createdAt: -1 }).lean().catch(() => [])
    // Attach latest receipt info (if any) to each allocation for admin convenience
    try {
      const allocIds = list.map(l => l._id).filter(Boolean)
      if (allocIds.length > 0) {
        const Receipt = require('./models/Receipt')
        const recs = await Receipt.find({ allocationId: { $in: allocIds } }).sort({ createdAt: -1 }).lean().catch(() => [])
        const map = {}
        for (const r of recs) {
          const key = String(r.allocationId || r.allocationId)
          if (!map[key]) map[key] = r
        }
        for (const l of list) {
          const k = String(l._id)
          if (map[k]) {
            l.receiptId = map[k]._id
            l.receiptPdfUrl = map[k].pdfUrl || ''
          }
        }
      }
    } catch (e) { console.warn('Failed to attach hostel receipts to allocations', e && e.message) }
    return res.json(list)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Create allocation
app.post('/api/hostel/allocations', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const payload = req.body || {}
    const required = ['when', 'hostelId', 'floorNo', 'roomNo', 'bedIndex', 'student', 'bedType', 'fee']
    for (const k of required) { if (payload[k] === undefined || payload[k] === null) return res.status(400).json({ message: `${k} required` }) }
    const doc = await HostelAllocation.create(payload)

    // Map parts to academic terms for clarity
    function mapPartToTerm(idx) {
      const terms = ['Term I', 'Term II', 'Term III']
      return terms[idx - 1] || `Term ${idx}`
    }

    // If option is add-to-fee, append fee parts to student's assignedFees; if pay-now, create a receipt stub
    try {
      if (payload.fee && payload.student && payload.student.id) {
        const parts = Number(payload.fee.parts || 1)
        const per = Number(payload.fee.perPart || payload.fee.amount || 0)
        const note = `Hostel ${payload.hostelId} Floor ${payload.floorNo} Room ${payload.roomNo} Bed ${Number(payload.bedIndex)+1} (${payload.bedType})`
        if (String(payload.fee.option) === 'add-to-fee') {
          const termEntries = []
          for (let i = 1; i <= Math.max(1, parts); i++) {
            termEntries.push({ term: mapPartToTerm(i), amount: per, note, by: req.user && req.user.sub })
          }
          await Student.findByIdAndUpdate(payload.student.id, { $push: { assignedFees: { $each: termEntries } } }).lean().catch(() => null)
        } else if (String(payload.fee.option) === 'pay-now') {
          // Create a single receipt stub for immediate payment (integration can update ids later)
          const Receipt = require('./models/Receipt')
          await Receipt.create({
            studentId: payload.student.id,
            studentName: payload.student.name,
            studentEmail: payload.student.email || '',
            class: payload.student.class || '',
            term: 'Hostel (Pay Now)',
            amount: Number(payload.fee.amount || per * parts) || 0
          }).catch(() => null)
        }
      }
    } catch (e) {
      console.warn('Failed to append hostel fee parts to student assignedFees', e && e.message)
    }

    return res.status(201).json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Mark an allocation as paid (creates a receipt)
app.post('/api/hostel/allocations/:id/mark-paid', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    const alloc = await HostelAllocation.findById(id).catch(() => null)
    if (!alloc) return res.status(404).json({ message: 'Allocation not found' })
    // Only student who owns it or admin can mark paid
    const isOwner = req.user && alloc.student && String(alloc.student.id) === String(req.user.sub)
    const isAdmin = req.user && req.user.role === 'admin'
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Forbidden' })

    const ReceiptModel = require('./models/Receipt')
    // create receipt document
    const receiptDoc = await ReceiptModel.create({
      studentId: alloc.student.id,
      allocationId: alloc._id,
      studentName: alloc.student.name,
      studentEmail: alloc.student.email || '',
      class: alloc.student.class || '',
      term: 'Hostel Payment',
      amount: Number(alloc.fee.amount || 0) || 0
    })
    // try to fill rollNo from Student document
    try {
      let sdoc = null
      if (alloc && alloc.student && alloc.student.id) {
        try { sdoc = await Student.findById(alloc.student.id).lean().catch(() => null) } catch (e) { sdoc = null }
      }
      if (!sdoc && receiptDoc.studentEmail) {
        try { sdoc = await Student.findOne({ email: receiptDoc.studentEmail }).lean().catch(() => null) } catch (e) { sdoc = null }
      }
      if (sdoc) {
        if (!receiptDoc.rollNo && sdoc.rollNo) receiptDoc.rollNo = sdoc.rollNo
        await receiptDoc.save().catch(() => null)
      }
    } catch (e) { console.warn('Failed to enrich hostel receipt with student roll/class', e && e.message) }
    // try generate PDF and attach
    try {
      const gen = await generateReceiptPdf(receiptDoc.toObject ? receiptDoc.toObject() : receiptDoc, alloc.toObject ? alloc.toObject() : alloc)
      if (gen) {
        receiptDoc.pdfPath = gen.pdfPath
        receiptDoc.pdfUrl = gen.pdfUrl
        await receiptDoc.save().catch(() => null)
      }
    } catch (e) { console.warn('pdf gen failed on mark-paid', e && e.message) }

    // update allocation: add payment record and mark paid
    try {
      const p = { partIndex: 0, amount: Number(receiptDoc.amount || 0), orderId: '', paymentId: '', receiptId: String(receiptDoc._id), status: 'paid' }
      alloc.payments = alloc.payments || []
      alloc.payments.push(p)
      alloc.paid = true
      await alloc.save()
    } catch (e) { console.warn('Failed to update allocation with receipt', e && e.message) }

    const updated = await HostelAllocation.findById(id).lean().catch(() => null)
    return res.json(updated)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Receipts: list my receipts
app.get('/api/receipts/my', verifyToken, async (req, res) => {
  try {
    const Receipt = require('./models/Receipt')
    const userId = req.user && req.user.sub
    if (!userId) return res.status(401).json({ message: 'Not authenticated' })
    const list = await Receipt.find({ studentId: userId }).sort({ createdAt: -1 }).lean().catch(() => [])
    return res.json(list)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Hostel receipts: list my hostel receipts (separate from generic receipts list)
app.get('/api/hostel/receipts/my', verifyToken, async (req, res) => {
  try {
    const Receipt = require('./models/Receipt')
    const userId = req.user && req.user.sub
    if (!userId) return res.status(401).json({ message: 'Not authenticated' })

    // Resolve Student document (allocations embed student.id as Student._id). Fall back to matching by user email.
    let studentDoc = null
    try { studentDoc = await Student.findById(userId).lean().catch(() => null) } catch (e) { studentDoc = null }

    // Find allocations for this student using the resolved student id or user email
    let allocs = []
    try {
      if (studentDoc && studentDoc._id) {
        allocs = await HostelAllocation.find({ 'student.id': studentDoc._id }).lean().catch(() => [])
      } else {
        // try matching by user.username (email) stored in embedded allocation student.email
        let u = null
        try { u = await User.findById(userId).lean().catch(() => null) } catch (e) { u = null }
        if (u && u.username) {
          allocs = await HostelAllocation.find({ 'student.email': u.username }).lean().catch(() => [])
        }
      }
    } catch (e) { allocs = [] }

    const allocIds = allocs.map(a => a._id).filter(Boolean)

    // Build list of possible studentId values that may appear on receipts (some code uses User._id, some uses Student._id)
    const studentIds = [String(userId)]
    if (studentDoc && studentDoc._id && String(studentDoc._id) !== String(userId)) studentIds.push(String(studentDoc._id))

    // Query receipts that belong to this student (by id) or are tied to one of the student's hostel allocations
    const filter = allocIds.length > 0 ? { $or: [ { studentId: { $in: studentIds } }, { allocationId: { $in: allocIds } } ] } : { studentId: { $in: studentIds } }
    const list = await Receipt.find(filter).sort({ createdAt: -1 }).lean().catch(() => [])
    return res.json(list)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: backfill/complete missing hostel receipts (populate rollNo/class/pdfUrl where possible)
app.post('/api/hostel/receipts/backfill', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const ReceiptModel = require('./models/Receipt')
    // Find receipts that are likely incomplete: missing rollNo or missing pdfUrl
    const candidates = await ReceiptModel.find({ $or: [ { rollNo: { $exists: false } }, { rollNo: '' }, { pdfUrl: { $exists: false } }, { pdfUrl: '' } ] }).limit(500).lean().catch(() => [])
    const results = []
    for (const r of candidates) {
      try {
        let updated = false
        let doc = await ReceiptModel.findById(r._id).catch(() => null)
        if (!doc) continue
        // attempt to fill student info
        let sdoc = null
        if (doc.studentId) {
          try { sdoc = await Student.findById(doc.studentId).lean().catch(() => null) } catch (e) { sdoc = null }
        }
        if (!sdoc && doc.studentEmail) {
          try { sdoc = await Student.findOne({ email: doc.studentEmail }).lean().catch(() => null) } catch (e) { sdoc = null }
        }
        if (sdoc) {
          if ((!doc.rollNo || doc.rollNo === '') && sdoc.rollNo) { doc.rollNo = sdoc.rollNo; updated = true }
          if ((!doc.class || doc.class === '') && (sdoc.class || sdoc.studentClass)) { doc.class = sdoc.class || sdoc.studentClass; updated = true }
          if ((!doc.studentName || doc.studentName === '') && sdoc.name) { doc.studentName = sdoc.name; updated = true }
        }
        // attempt to attach allocation info and generate pdf if missing
        let alloc = null
        if (doc.allocationId) {
          try { alloc = await HostelAllocation.findById(doc.allocationId).lean().catch(() => null) } catch (e) { alloc = null }
        }
        if ((!doc.pdfUrl || doc.pdfUrl === '') && doc._id) {
          try {
            const gen = await generateReceiptPdf(doc.toObject ? doc.toObject() : doc, alloc && alloc.toObject ? alloc.toObject() : alloc)
            if (gen) {
              doc.pdfPath = gen.pdfPath
              doc.pdfUrl = gen.pdfUrl
              updated = true
            }
          } catch (e) { console.warn('pdf gen backfill failed for', String(doc._id), e && e.message) }
        }
        if (updated) await doc.save().catch(() => null)
        results.push({ id: String(r._id), updated })
      } catch (e) { console.warn('backfill item failed', e && e.message) }
    }
    return res.json({ ok: true, processed: results.length, results })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Delete all allocations (admin-only)
app.delete('/api/hostel/allocations', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    await HostelAllocation.deleteMany({})
    return res.json({ ok: true })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Hostel CRUD APIs
// List all hostels
app.get('/api/hostels', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await Hostel.find({}).sort({ createdAt: -1 }).lean().catch(() => [])
    return res.json(list)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Student: view my hostel allocations
app.get('/api/hostel/allocations/my', verifyToken, async (req, res) => {
  try {
    const userId = req.user && req.user.sub
    if (!userId) return res.status(401).json({ message: 'Not authenticated' })
    let filter = {}
    // Try to resolve a Student document for this authenticated user
    let studentDoc = null
    try { studentDoc = await Student.findById(userId).lean().catch(() => null) } catch {}
    if (studentDoc && studentDoc._id) {
      filter['student.id'] = studentDoc._id
    } else {
      // Fallback: match by email/username in embedded allocation data
      let u = null
      try { u = await User.findById(userId).lean().catch(() => null) } catch {}
      if (u && u.username) {
        filter['student.email'] = u.username
      } else {
        // As a last resort, return no allocations rather than leaking data
        filter['student.id'] = userId
      }
    }
    const list = await HostelAllocation.find(filter).sort({ createdAt: -1 }).lean().catch(() => [])
    return res.json(list)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Public: minimal hostel list (no auth) for student display
app.get('/api/hostels/public', async (req, res) => {
  try {
    const list = await Hostel.find({}, { name: 1, floors: 1 }).sort({ createdAt: -1 }).lean().catch(() => [])
    return res.json(list)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Create a hostel
app.post('/api/hostels', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, floors, address, capacity, amenities, warden, contact } = req.body || {}
    if (!name) return res.status(400).json({ message: 'name required' })
    const doc = await Hostel.create({
      name: String(name).trim(),
      floors: Array.isArray(floors) ? floors : [],
      address: address || '',
      capacity: Number(capacity || 0),
      amenities: Array.isArray(amenities) ? amenities : [],
      warden: warden || '',
      contact: contact || ''
    })
    return res.status(201).json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Update a hostel
app.put('/api/hostels/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params
    const payload = req.body || {}
    const doc = await Hostel.findByIdAndUpdate(id, payload, { new: true }).lean().catch(() => null)
    if (!doc) return res.status(404).json({ message: 'Hostel not found' })
    return res.json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Delete a hostel
app.delete('/api/hostels/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params
    const doc = await Hostel.findByIdAndDelete(id).lean().catch(() => null)
    if (!doc) return res.status(404).json({ message: 'Hostel not found' })
    return res.json({ ok: true })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})


// try to require mammoth for docx parsing; optional dependency
let mammoth = null
try { mammoth = require('mammoth') } catch (e) { mammoth = null }
// try to require pdf-parse for PDF parsing; optional dependency
let pdfParse = null
try { pdfParse = require('pdf-parse') } catch (e) { pdfParse = null }
// optional PDF generator for receipts
// `PDFDocument` is consolidated at the top of the file. If it's not available, try to require here.
if (!PDFDocument) {
  try { PDFDocument = require('pdfkit') } catch (e) { PDFDocument = null }
}

// Helper: generate a simple PDF receipt and save to uploads directory. Returns { pdfPath, pdfUrl }
async function generateReceiptPdf(receipt, allocation, type = 'hostel') {
  if (!PDFDocument) return null
  try {
    const fname = `receipt_${type}_${String(receipt._id || Date.now())}.pdf`
    const outPath = path.join(uploadsDir, fname)
    await new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 })
        const outStream = fs.createWriteStream(outPath)
        outStream.on('finish', () => resolve())
        outStream.on('error', (err) => reject(err))
        doc.pipe(outStream)
        doc.fontSize(18).text('School Name', { align: 'left' })
        doc.moveDown()
        doc.fontSize(12).text(`Receipt ID: ${String(receipt._id || '')}`)
        doc.text(`Date: ${new Date(receipt.createdAt || Date.now()).toLocaleString()}`)
        doc.moveDown()
        doc.fontSize(12).text(`Student: ${receipt.studentName || ''}`)
        if (receipt.rollNo) doc.text(`Roll No: ${receipt.rollNo}`)
        if (receipt.class) doc.text(`Class: ${receipt.class}`)
        if (type === 'hostel' && allocation) {
          try {
            doc.moveDown()
            doc.text(`Hostel: ${allocation.hostelId || ''}`)
            doc.text(`Room: ${allocation.floorNo || ''} / ${allocation.roomNo || ''} / B${(Number(allocation.bedIndex) + 1) || ''}`)
          } catch (e) {}
        }
        if (type === 'transport' && allocation) {
          try {
            doc.moveDown()
            // Prefer human-readable names saved on the receipt first, then allocation names, then IDs
            const routeName = (receipt && receipt.routeName) || (allocation && allocation.routeName) || (allocation && allocation.routeId) || ''
            const stopName = (receipt && receipt.stopName) || (allocation && allocation.stopName) || (allocation && allocation.stopId) || ''
            const busName = (receipt && receipt.busName) || (allocation && allocation.busName) || (allocation && allocation.busId) || ''
            doc.text(`Route: ${routeName}`)
            doc.text(`Stop: ${stopName}`)
            doc.text(`Bus: ${busName}`)
            doc.text(`Seat: ${allocation.seatNo || ''}`)
          } catch (e) {}
        }
        doc.moveDown()
        if (type === 'hostel') {
          doc.fontSize(14).text(`Term: ${receipt.term || ''}`)
        } else {
          doc.fontSize(14).text(`Transport Fee`)
        }
        doc.moveDown()
        doc.fontSize(16).text(`Amount Paid: ₹${Number(receipt.amount || 0)}`, { align: 'left' })
        doc.moveDown(2)
        if (receipt.razorpayPaymentId) doc.fontSize(10).text(`Payment ID: ${receipt.razorpayPaymentId}`)
        if (receipt.razorpayOrderId) doc.fontSize(10).text(`Order ID: ${receipt.razorpayOrderId}`)
        doc.end()
      } catch (e) { return reject(e) }
    })
    return { pdfPath: outPath, pdfUrl: `/uploads/${fname}` }
  } catch (e) {
    console.warn('Failed to generate PDF', e && (e.message || e))
    return null
  }
}

// Create Razorpay order (or stub if razorpayClient not configured)
app.post('/api/payments/order', verifyToken, async (req, res) => {
  try {
    const { amount, receipt } = req.body || {}
    if (!amount) return res.status(400).json({ message: 'amount required' })
    const amt = Math.round(Number(amount) * 100) // rupees -> paise
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ message: 'valid amount required' })
    const receiptId = String(receipt || `rcpt_${Date.now()}`).slice(0, 40)
    if (razorpayClient) {
      const ord = await razorpayClient.orders.create({ amount: amt, currency: 'INR', receipt: receiptId })
      // attach key id so frontend can initialize checkout with correct key
      try { ord.keyId = process.env.RAZORPAY_KEY_ID || '' } catch (e) {}
      return res.json(ord)
    }
    // stub order (no key available)
    return res.json({ id: `stub_${Date.now()}`, amount: amt, currency: 'INR', receipt: receiptId, keyId: process.env.RAZORPAY_KEY_ID || '' })
  } catch (e) { return res.status(500).json({ message: e.message || 'Failed to create order' }) }
})

// Confirm payment: accepts razorpay ids, creates Receipt, generates PDF and updates allocation/payments
app.post('/api/payments/confirm', verifyToken, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, allocationId, studentId, studentName, studentEmail, class: studentClass, term, amount } = req.body || {}
    if (!razorpay_order_id || !razorpay_payment_id) return res.status(400).json({ message: 'order_id and payment_id required' })

    if (process.env.RAZORPAY_KEY_SECRET) {
      if (!razorpay_signature) return res.status(400).json({ message: 'payment signature required' })
      const crypto = require('crypto')
      const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex')
      if (expectedSignature !== razorpay_signature) return res.status(400).json({ message: 'Invalid payment signature' })
    }

    if (studentId) {
      const role = req.user && req.user.role
      if (role === 'parent') {
        const parent = await User.findById(req.user.sub).lean().catch(() => null)
        const linked = parent && Array.isArray(parent.parentOf) && parent.parentOf.some(x => String(x) === String(studentId))
        if (!linked) return res.status(403).json({ message: 'Parent is not linked to this student' })
      } else if (role === 'student') {
        const currentStudent = await Student.findOne({ email: req.user && req.user.username }).lean().catch(() => null)
        if (!currentStudent || String(currentStudent._id) !== String(studentId)) return res.status(403).json({ message: 'Cannot pay for another student' })
      }
    }

    const ReceiptModel = require('./models/Receipt')
    const alloc = allocationId ? await HostelAllocation.findById(allocationId).catch(() => null) : null
    const receipt = await ReceiptModel.create({
      studentId: studentId || (alloc && alloc.student && alloc.student.id) || null,
      allocationId: allocationId || (alloc && alloc._id) || null,
      studentName: studentName || (alloc && alloc.student && alloc.student.name) || '',
      studentEmail: studentEmail || (alloc && alloc.student && alloc.student.email) || '',
      class: studentClass || (alloc && alloc.student && alloc.student.class) || '',
      term: term || '',
      amount: Number(amount || 0) || 0,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature || ''
    })
    // try to populate rollNo and normalize student info from Student document when possible
    try {
      const sid = receipt.studentId || receipt.studentId === 0 ? receipt.studentId : null
      let sdoc = null
      if (sid) {
        try { sdoc = await Student.findById(sid).lean().catch(() => null) } catch (e) { sdoc = null }
      }
      if (!sdoc && receipt.studentEmail) {
        try { sdoc = await Student.findOne({ email: receipt.studentEmail }).lean().catch(() => null) } catch (e) { sdoc = null }
      }
      if (sdoc) {
        if (!receipt.rollNo && sdoc.rollNo) receipt.rollNo = sdoc.rollNo
        if ((!receipt.class || receipt.class === '') && (sdoc.class || sdoc.studentClass)) receipt.class = sdoc.class || sdoc.studentClass || ''
        if (!receipt.studentName && sdoc.name) receipt.studentName = sdoc.name
        await receipt.save().catch(() => null)
      }
    } catch (e) { console.warn('Failed to enrich receipt with student info', e && e.message) }

    // generate PDF
    try {
      const gen = await generateReceiptPdf(receipt.toObject ? receipt.toObject() : receipt, alloc && alloc.toObject ? alloc.toObject() : alloc)
      if (gen) {
        receipt.pdfPath = gen.pdfPath
        receipt.pdfUrl = gen.pdfUrl
        await receipt.save().catch(() => null)
      }
    } catch (e) { console.warn('pdf gen failed on confirm', e && e.message) }

    // update allocation payments: mark specific term/part as paid
    try {
      if (alloc) {
        const payments = alloc.payments || []
        // derive partIndex from term like 'Term 1' or 'Term I'
        let partIndex = null
        const m = String(term || '').match(/(\d+)/)
        if (m) partIndex = Number(m[0])
        const p = { partIndex: partIndex || 0, amount: Number(receipt.amount || 0), orderId: razorpay_order_id, paymentId: razorpay_payment_id, receiptId: String(receipt._id), status: 'paid' }
        payments.push(p)
        alloc.payments = payments
        // if parts count equals payments with status paid, mark alloc.paid true
        try {
          const parts = alloc.fee && Number(alloc.fee.parts || 1)
          const paidCount = (payments || []).filter(x => x.status === 'paid').length
          if (parts && paidCount >= parts) alloc.paid = true
        } catch (e) {}
        await alloc.save()
      }
    } catch (e) { console.warn('Failed to update allocation payments on confirm', e && e.message) }

    return res.json({ ok: true, receipt })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Return current authenticated student's document
// This handler tries multiple strategies to resolve the student document:
// 1) If `req.user.sub` matches a Student _id, return that
// 2) Otherwise, try to resolve by `req.user.username` (email)
// 3) If still not found, return 404
app.get('/api/students/me', verifyToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const userId = req.user && req.user.sub
    const username = req.user && req.user.username
    let s = null
    if (userId) {
      try { s = await Student.findById(userId).lean().catch(() => null) } catch (e) { s = null }
    }
    if (!s && username) {
      try { s = await Student.findOne({ email: username }).lean().catch(() => null) } catch (e) { s = null }
    }
    if (!s) return res.status(404).json({ message: 'Student record not found' })
    return res.json(s)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// helper to generate short parent access codes
function generateParentCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

// ===================== Test Results APIs (student & admin/faculty) =====================
// Get current authenticated student's test results
app.get('/api/tests/results/my', verifyToken, async (req, res) => {
  try {
    // Expect student role; still allow parent/admin to fetch by their linked student later if needed
    const userId = req.user && req.user.sub
    if (!userId) return res.status(401).json({ message: 'Not authenticated' })

    // Find student record for this user
    let student = null
    try { student = await Student.findById(userId).lean().catch(() => null) } catch {}
    const filter = {}
    if (student) {
      filter.studentId = student._id
    } else {
      // Fallback: if user has an email, match by email in results
      const User = require('./models/User')
      let u = null
      try { u = await User.findById(userId).lean().catch(() => null) } catch {}
      if (u && u.username) filter.email = u.username
    }

    const list = await TestResult.find(filter).sort({ submittedAt: -1, createdAt: -1 }).lean().catch(() => [])
    return res.json(list)
  } catch (e) {
    return res.status(500).json({ message: e.message || 'Failed to load my test results' })
  }
})

// Get test results by student id (admin/faculty)
app.get('/api/tests/results/by-student/:studentId', verifyToken, async (req, res) => {
  try {
    const { studentId } = req.params
    if (!studentId) return res.status(400).json({ message: 'studentId required' })
    const list = await TestResult.find({ studentId }).sort({ submittedAt: -1, createdAt: -1 }).lean().catch(() => [])
    return res.json(list)
  } catch (e) {
    return res.status(500).json({ message: e.message || 'Failed to load test results' })
  }
})

      
app.put('/api/students/:id/change-house', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params
    const { house } = req.body || {}
    const allowed = ['Blue', 'Green', 'Red', 'Yellow']
    if (!allowed.includes(String(house))) return res.status(400).json({ message: 'Invalid house' })
    const doc = await Student.findByIdAndUpdate(id, { $set: { house } }, { new: true }).lean().catch(() => null)
    if (!doc) return res.status(404).json({ message: 'Student not found' })
    return res.json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Set or clear a student's house role (e.g., Captain/Leader)
app.put('/api/students/:id/house-role', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params
    const { role } = req.body || {}
    const doc = await Student.findByIdAndUpdate(id, { $set: { houseRole: role || '' } }, { new: true }).lean().catch(() => null)
    if (!doc) return res.status(404).json({ message: 'Student not found' })
    return res.json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Bulk change house for many students at once
app.post('/api/students/bulk-change-house', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const updates = Array.isArray(req.body) ? req.body : req.body.updates
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: 'No updates provided' })
    }
    const allowed = ['Blue', 'Green', 'Red', 'Yellow']
    const ops = updates
      .filter(u => u && u.id && allowed.includes(String(u.house)))
      .map(u => ({
        updateOne: {
          filter: { _id: u.id },
          update: { $set: { house: u.house } }
        }
      }))
    if (ops.length === 0) return res.status(400).json({ message: 'No valid updates' })
    const result = await Student.bulkWrite(ops, { ordered: false })
    const modifiedCount = result.modifiedCount ?? (result.nModified || 0)
    return res.json({ ok: true, modifiedCount })
  } catch (err) {
    console.error('bulk-change-house error', err)
    return res.status(500).json({ message: 'Failed to bulk update houses' })
  }
})

// Generic file upload endpoint - returns public URL for uploaded file
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'file required' })
    const url = `/uploads/${req.file.filename}`
    return res.json({ url })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// ===================== ID Card APIs =====================
// Generate ID cards for a class & section in one batch
app.post('/api/idcards/generate', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const klass = req.body && req.body.class
    const section = req.body && req.body.section
    const schoolName = (req.body && req.body.schoolName) || 'SCHOOL NAME'
    const reqIssueDate = req.body && req.body.issueDate ? new Date(req.body.issueDate) : new Date()
    const reqValidUpto = req.body && req.body.validUpto ? new Date(req.body.validUpto) : new Date(reqIssueDate.getTime() + 365*24*60*60*1000)
    if (!klass || !section) return res.status(400).json({ message: 'class and section required' })
    const students = await Student.find({ class: String(klass), section: String(section) }).lean().catch(() => [])
    const batchId = `batch_${Date.now()}`
    const out = []
    for (const st of students) {
      let latest = null
      try { latest = await IDCard.findOne({ studentId: st._id }).sort({ version: -1, createdAt: -1 }).lean().catch(() => null) } catch {}
      const version = latest ? Number(latest.version || 1) + 1 : 1
        let idCode = latest && latest.idCode ? latest.idCode : makeId('IDC_')
        let created = null
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            created = await IDCard.create({
              studentId: st._id,
              type: 'student',
              name: st.name || '',
              fatherName: st.fatherName || '',
              rollNo: st.rollNo || '',
              class: st.class || String(klass),
              medium: st.medium || '',
              section: st.section || String(section),
              contact: st.contact || '',
              house: st.house || '',
              houseRole: st.houseRole || '',
              schoolName,
              photoUrl: st.avatar || '',
              template: 'default',
              batchId,
              version,
              generatedBy: req.user && req.user.sub,
              idCode,
              issueDate: reqIssueDate,
              validUpto: reqValidUpto,
            })
            break
          } catch (err) {
            if (String(err && err.code) === '11000') {
              // duplicate idCode - generate a fresh code and retry
              idCode = makeId('IDC_')
              continue
            }
            throw err
          }
        }
        if (created) out.push(created)
    }
    return res.json({ batchId, count: out.length, cards: out })
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Generate ID cards for all faculty
app.post('/api/idcards/generate-faculty', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const schoolName = (req.body && req.body.schoolName) || 'SCHOOL NAME'
    const reqIssueDate = req.body && req.body.issueDate ? new Date(req.body.issueDate) : new Date()
    const reqValidUpto = req.body && req.body.validUpto ? new Date(req.body.validUpto) : new Date(reqIssueDate.getTime() + 365*24*60*60*1000)
    const list = await Faculty.find({}).lean().catch(() => [])
    const batchId = `fac_${Date.now()}`
    const out = []
    for (const f of list) {
      let latest = null
      try { latest = await IDCard.findOne({ facultyId: f._id }).sort({ version: -1, createdAt: -1 }).lean().catch(() => null) } catch {}
      const version = latest ? Number(latest.version || 1) + 1 : 1
      let idCode = latest && latest.idCode ? latest.idCode : makeId('IDF_')
      let created = null
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          created = await IDCard.create({
            facultyId: f._id,
            type: 'faculty',
            name: f.name || '',
            fatherName: '',
            rollNo: f.employeeId || '',
            gender: f.gender || '',
            class: '',
            section: '',
            contact: f.contact || '',
            email: f.email || '',
            designation: (f.designation || f.subject || ''),
            schoolName,
            photoUrl: f.avatar || '',
            template: 'default',
            batchId,
            version,
            generatedBy: req.user && req.user.sub,
            idCode,
            issueDate: reqIssueDate,
            validUpto: reqValidUpto,
          })
          break
        } catch (err) {
          if (String(err && err.code) === '11000') { // duplicate idCode
            idCode = makeId('IDF_')
            continue
          }
          throw err
        }
      }
      if (created) out.push(created)
    }
    return res.json({ batchId, count: out.length, cards: out })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Generate ID cards for staff (users with role 'admin')
app.post('/api/idcards/generate-staff', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const schoolName = (req.body && req.body.schoolName) || 'SCHOOL NAME'
    const reqIssueDate = req.body && req.body.issueDate ? new Date(req.body.issueDate) : new Date()
    const reqValidUpto = req.body && req.body.validUpto ? new Date(req.body.validUpto) : new Date(reqIssueDate.getTime() + 365*24*60*60*1000)
    const list = await User.find({ role: 'staff' }).lean().catch(() => [])
    const batchId = `stf_${Date.now()}`
    const out = []
    for (const u of list) {
      let latest = null
      try { latest = await IDCard.findOne({ userId: u._id }).sort({ version: -1, createdAt: -1 }).lean().catch(() => null) } catch {}
      const version = latest ? Number(latest.version || 1) + 1 : 1
      let idCode = latest && latest.idCode ? latest.idCode : makeId('IDS_')
      const staffId = `STF-${String(u._id).slice(-6).toUpperCase()}`
      let created = null
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          created = await IDCard.create({
            userId: u._id,
            type: 'staff',
            name: u.name || u.username || '',
            fatherName: '',
            rollNo: staffId,
            gender: u.gender || '',
            class: '',
            section: '',
            contact: u.contact || '',
            schoolName,
            photoUrl: u.avatar || '',
            template: 'default',
            batchId,
            version,
            generatedBy: req.user && req.user.sub,
            idCode,
            issueDate: reqIssueDate,
            validUpto: reqValidUpto,
            email: u.username || '',
          })
          break
        } catch (err) {
          if (String(err && err.code) === '11000') { // duplicate idCode
            idCode = makeId('IDS_')
            continue
          }
          throw err
        }
      }
      if (created) out.push(created)
    }
    return res.json({ batchId, count: out.length, cards: out })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Update an individual ID card (e.g., add/change photo or fields)
app.put('/api/idcards/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params
    const allowed = ['name', 'fatherName', 'rollNo', 'class', 'section', 'contact', 'email', 'designation', 'schoolName', 'photoUrl', 'template', 'issueDate', 'validUpto', 'medium', 'gender']
    const patch = {}
    for (const k of allowed) if (req.body && Object.prototype.hasOwnProperty.call(req.body, k)) patch[k] = req.body[k]
    const doc = await IDCard.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean().catch(() => null)
    if (!doc) return res.status(404).json({ message: 'Card not found' })
    return res.json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// List latest ID cards for a class and section (default latest per student)
app.get('/api/idcards', verifyToken, async (req, res) => {
  try {
    const { class: klass, section, latest = 'true' } = req.query || {}
    const filter = {}
    if (klass) filter.class = String(klass)
    if (section) filter.section = String(section)
    const list = await IDCard.find(filter).sort({ createdAt: -1 }).lean().catch(() => [])
    if (String(latest) !== 'false') {
      const map = new Map()
      for (const c of list) {
        const key = String(c.studentId)
        if (!map.has(key)) map.set(key, c)
      }
      return res.json(Array.from(map.values()))
    }
    return res.json(list)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Get batches summary (history) by class/section
app.get('/api/idcards/batches', verifyToken, async (req, res) => {
  try {
    const { class: klass, section } = req.query || {}
    const match = {}
    if (klass) match.class = String(klass)
    if (section) match.section = String(section)
    const agg = await IDCard.aggregate([
      { $match: match },
      { $group: { _id: '$batchId', count: { $sum: 1 }, class: { $first: '$class' }, section: { $first: '$section' }, latestAt: { $max: '$createdAt' } } },
      { $sort: { latestAt: -1 } },
    ]).catch(() => [])
    const rows = agg.map(a => ({ batchId: a._id, count: a.count, class: a.class, section: a.section, date: a.latestAt }))
    return res.json(rows)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Get cards by batch id
app.get('/api/idcards/by-batch/:batchId', verifyToken, async (req, res) => {
  try { const list = await IDCard.find({ batchId: req.params.batchId }).sort({ createdAt: -1 }).lean().catch(() => []); return res.json(list) } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Latest card for a student
app.get('/api/idcards/student/:studentId', verifyToken, async (req, res) => {
  try {
    const { studentId } = req.params
    let doc = await IDCard.findOne({ studentId }).sort({ version: -1, createdAt: -1 }).lean().catch(() => null)
    if (!doc) return res.status(404).json({ message: 'No card found' })
    // Enrich house and houseRole from current Student if missing or empty
    try {
      if (!doc.house || !doc.houseRole) {
        const st = await Student.findById(studentId).lean().catch(() => null)
        if (st) {
          doc = { ...doc, house: doc.house || st.house || '', houseRole: doc.houseRole || st.houseRole || '', gender: doc.gender || st.gender || '' }
        }
      }
    } catch {}
    return res.json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Latest card for a faculty
app.get('/api/idcards/faculty/:facultyId', verifyToken, async (req, res) => {
  try {
    const { facultyId } = req.params
    const doc = await IDCard.findOne({ facultyId }).sort({ version: -1, createdAt: -1 }).lean().catch(() => null)
    if (!doc) return res.status(404).json({ message: 'No card found' })
    return res.json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Latest card for a staff user
app.get('/api/idcards/staff/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params
    const doc = await IDCard.findOne({ userId, type: 'staff' }).sort({ version: -1, createdAt: -1 }).lean().catch(() => null)
    if (!doc) return res.status(404).json({ message: 'No card found' })
    return res.json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})
// Backfill idCode for existing cards missing the code
app.post('/api/idcards/backfill-codes', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const cards = await IDCard.find({ $or: [{ idCode: { $exists: false } }, { idCode: null }, { idCode: '' }] }).lean().catch(() => [])
    let updated = 0
    for (const c of cards) {
      const code = makeId('IDC_')
      await IDCard.updateOne({ _id: c._id }, { $set: { idCode: code } }).catch(() => null)
      updated++
    }
    return res.json({ updated })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Verify ID card authenticity by code (public)
app.get('/api/idcards/verify/:code', async (req, res) => {
  try {
    const code = req.params && req.params.code
    if (!code) return res.status(400).json({ message: 'code required' })
    let doc = await IDCard.findOne({ idCode: code }).lean().catch(() => null)
    if (!doc) return res.status(404).json({ message: 'Invalid code' })

    // Derive type if missing based on idCode prefix
    let derivedType = doc.type
    if (!derivedType || derivedType === '') {
      if (String(code).startsWith('IDF_')) derivedType = 'faculty'
      else if (String(code).startsWith('IDS_')) derivedType = 'staff'
      else derivedType = 'student'
    }

    // Enrich missing fields based on type/owner document
    if (derivedType === 'student' && doc.studentId) {
      try {
        const st = await Student.findById(doc.studentId).lean().catch(() => null)
        if (st) {
          if (!doc.house) doc.house = st.house || ''
          if (!doc.houseRole) doc.houseRole = st.houseRole || ''
          if (!doc.photoUrl && st.avatar) doc.photoUrl = st.avatar
          if (!doc.name && st.name) doc.name = st.name
          if (!doc.rollNo && st.rollNo) doc.rollNo = st.rollNo
          if (!doc.class && st.class) doc.class = st.class
          if (!doc.section && st.section) doc.section = st.section
          if (!doc.gender && st.gender) doc.gender = st.gender
        }
      } catch {}
    }
    if (derivedType === 'faculty' && doc.facultyId) {
      try {
        const f = await Faculty.findById(doc.facultyId).lean().catch(() => null)
        if (f) {
          if (!doc.photoUrl && f.avatar) doc.photoUrl = f.avatar
          if (!doc.name && f.name) doc.name = f.name
          if (!doc.rollNo && f.employeeId) doc.rollNo = f.employeeId
          if (!doc.designation && (f.designation || f.subject)) doc.designation = (f.designation || f.subject)
          if (!doc.email && f.email) doc.email = f.email
          // If still no photo, try User avatar linked by faculty email
          if (!doc.photoUrl && f.email) {
            try {
              const u = await User.findOne({ role: 'faculty', username: f.email }).lean().catch(() => null)
              if (u && u.avatar) doc.photoUrl = u.avatar
            } catch {}
          }
        }
      } catch {}
    }
    if (derivedType === 'staff' && doc.userId) {
      try {
        const u = await User.findById(doc.userId).lean().catch(() => null)
        if (u) {
          if (!doc.photoUrl && u.avatar) doc.photoUrl = u.avatar
          if (!doc.name && (u.name || u.username)) doc.name = (u.name || u.username)
        }
      } catch {}
    }

    return res.json({ ...doc, type: derivedType })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Simple in-memory SSE clients list for admin notification stream
const sseClients = new Set()

function sendSseEvent(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of sseClients) {
    try {
      res.write(payload)
    } catch (e) {
      // ignore write errors; client cleanup will remove closed connections
    }
  }
}

// Helper to send mail. Supports: direct SMTP, SendGrid via API key (SMTP relay), and an Ethereal test account fallback.
// Returns { attempted, sent, info, error }
async function sendMail({ to, subject, html, text, attachments }) {
  const status = { attempted: false, sent: false, info: null, error: null }
  try {
    // small retry helper for transient network errors
    async function retryAsync(fn, attempts = 2, delayMs = 1000) {
      let lastErr = null
      for (let i = 0; i < attempts; i++) {
        try {
          return await fn()
        } catch (e) {
          lastErr = e
          if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs))
        }
      }
      throw lastErr
    }
    const nodemailer = require('nodemailer')
    // Prefer SendGrid Web API when key is provided and SENDGRID_USE_WEB !== 'false'
    const useSendGridWeb = !!process.env.SENDGRID_API_KEY && (String(process.env.SENDGRID_USE_WEB || 'true').toLowerCase() !== 'false')
    let sgMail = null
    if (useSendGridWeb) {
      try {
        sgMail = require('@sendgrid/mail')
        sgMail.setApiKey(process.env.SENDGRID_API_KEY)
      } catch (e) {
        // if module not available, we'll fallback to SMTP relay below
        sgMail = null
      }
    }
    // Diagnostic logs to help debug delivery on hosts like Render
    try {
      console.log('sendMail: useSendGridWeb=', useSendGridWeb)
      console.log('sendMail: SENDGRID_API_KEY present=', !!process.env.SENDGRID_API_KEY)
      console.log('sendMail: sgMail module loaded=', !!sgMail)
      console.log('sendMail: SMTP_HOST present=', !!process.env.SMTP_HOST, 'SMTP_USER present=', !!process.env.SMTP_USER)
    } catch (e) { /* ignore logging errors */ }

    // Primary SMTP config (explicit)
    const smtpHost = process.env.SMTP_HOST
    const smtpPort = process.env.SMTP_PORT
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    const from = process.env.FROM_EMAIL || (smtpUser || 'no-reply@example.com')

    let transporter = null

    // Respect API-only mode: when SENDGRID_API_ONLY is 'true', skip any explicit SMTP transport creation
    const sendgridApiOnly = String(process.env.SENDGRID_API_ONLY || 'false').toLowerCase() === 'true'

    // If explicit SMTP provided and not in API-only mode, use it. Allow overriding TLS rejection and enable optional debug/logging via env.
    if (!sendgridApiOnly && smtpHost && smtpPort && smtpUser && smtpPass) {
      status.attempted = true
      const smtpTlsReject = (typeof process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'undefined')
        ? (String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED).toLowerCase() !== 'false')
        : (process.env.NODE_ENV === 'production')

      const smtpDebug = String(process.env.SMTP_DEBUG || '').toLowerCase() === 'true'

      transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(smtpPort),
        secure: Number(smtpPort) === 465,
        auth: { user: smtpUser, pass: smtpPass },
        tls: { rejectUnauthorized: smtpTlsReject },
        logger: smtpDebug,
        debug: smtpDebug
      })
    }

    // If SendGrid Web API is configured and available, use it directly (more reliable on some hosts)
    if (!transporter && sgMail) {
      status.attempted = true
      try {
        const from = process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@example.com'
        const msg = { to, from, subject }
        // Add optional Reply-To for replies (set via REPLY_TO env)
        if (process.env.REPLY_TO) msg.replyTo = process.env.REPLY_TO
        if (html) msg.html = html
        if (text) msg.text = text
        // Convert attachments for SendGrid (if simple inline content provided)
        if (attachments && Array.isArray(attachments) && attachments.length > 0) {
          msg.attachments = attachments.map(a => {
            // a.content may be a Buffer or string
            const content = a.content && Buffer.isBuffer(a.content) ? a.content.toString('base64') : (a.content || '')
            return { content, filename: a.filename || (a.path ? a.path.split('/').pop() : 'attachment'), type: a.contentType || a.contentType || a.contentType || a.mime || undefined, disposition: 'attachment' }
          })
        }
        try {
          const response = await retryAsync(() => sgMail.send(msg), 2, 1000)
          status.sent = true
          status.info = { sgResponse: response }
          console.log('Mail sent via SendGrid Web API to', to)
          return status
        } catch (e) {
          status.error = e && (e.message || String(e))
          try {
            console.warn('SendGrid Web API send failed after retries:', status.error)
            if (e && e.response && e.response.body) console.warn('SendGrid response body:', JSON.stringify(e.response.body))
          } catch (le) { /* ignore logging errors */ }
          try { if (e && e.stack) console.warn('SendGrid error stack:', e.stack) } catch (le) {}
          // continue to try SMTP fallback below
        }
      } catch (e) {
        status.error = e && (e.message || String(e))
        try {
          console.warn('SendGrid Web API failure:', status.error)
          if (e && e.response && e.response.body) console.warn('SendGrid response body:', JSON.stringify(e.response.body))
        } catch (le) { /* ignore logging errors */ }
        try { if (e && e.stack) console.warn('SendGrid error stack:', e.stack) } catch (le) {}
        // continue to try SMTP fallback below
      }
    }

    // Fallback: SendGrid SMTP relay when API key provided (if web API failed or not available)
    // Controlled by env `SENDGRID_SMTP_FALLBACK` (default 'true'). Set to 'false' to force Web API only.
    const allowSmtpFallback = String(process.env.SENDGRID_SMTP_FALLBACK || 'true').toLowerCase() === 'true'
    if (!transporter && process.env.SENDGRID_API_KEY && allowSmtpFallback && !sendgridApiOnly) {
      status.attempted = true
      transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: { user: 'apikey', pass: process.env.SENDGRID_API_KEY }
      })
    } else if (!transporter && process.env.SENDGRID_API_KEY && !allowSmtpFallback) {
      console.log('SendGrid SMTP fallback disabled by SENDGRID_SMTP_FALLBACK=false; skipping SMTP relay')
    } else if (!transporter && process.env.SENDGRID_API_KEY && allowSmtpFallback && sendgridApiOnly) {
      console.log('SENDGRID_API_ONLY=true set; skipping SMTP relay even though SENDGRID_SMTP_FALLBACK is enabled')
    }

    // If still no transporter and ENV set to allow test deliveries, use Ethereal (useful for development)
    if (!transporter && (process.env.USE_ETHEREAL === 'true' || process.env.NODE_ENV !== 'production')) {
      // createTestAccount can be slow; only do it when necessary
      status.attempted = true
      const testAccount = await nodemailer.createTestAccount()
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass }
      })
    }

    if (!transporter) {
      console.log('No mail transporter configured. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS or SENDGRID_API_KEY to enable email sending. Skipping mail to', to)
      return status
    }

    const mailOptions = { from, to, subject, html, text }
    // Include Reply-To header for SMTP deliveries if configured
    if (process.env.REPLY_TO) mailOptions.replyTo = process.env.REPLY_TO
    if (attachments) mailOptions.attachments = attachments

    let info = null
    try {
      info = await retryAsync(() => transporter.sendMail(mailOptions), 2, 1000)
    } catch (e) {
      throw e
    }
    status.sent = true
    status.info = { messageId: info && info.messageId, accepted: info && info.accepted }
    // If using Ethereal, print preview URL to logs
    try {
      if (nodemailer.getTestMessageUrl && nodemailer.getTestMessageUrl(info)) {
        const preview = nodemailer.getTestMessageUrl(info)
        console.log('Ethereal preview URL:', preview)
        status.info.preview = preview
      }
    } catch (e) { /* ignore */ }
    console.log('Mail sent:', status.info)
  } catch (err) {
    status.error = err && (err.message || String(err))
    console.warn('Failed to send mail to', to, status.error)
  }
  return status
}

// Debug: test mail endpoint (useful to verify mail delivery on host).
// If `DEBUG_MAIL_TOKEN` is set in env, the request must include header `X-Debug-Token: <token>`.
// WARNING: Keep this endpoint protected or remove it after testing in production.
app.post('/api/debug/send-test-mail', async (req, res) => {
  try {
    const debugToken = process.env.DEBUG_MAIL_TOKEN || ''
    if (debugToken) {
      const provided = req.get('X-Debug-Token') || ''
      if (provided !== debugToken) return res.status(403).json({ message: 'Forbidden' })
    }

    const { to, subject, html, text } = req.body || {}
    const toAddr = (to || process.env.TEST_MAIL_TO || '').trim()
    if (!toAddr) return res.status(400).json({ message: 'to (or TEST_MAIL_TO env) required' })

    const mailStatus = await sendMail({ to: toAddr, subject: subject || 'Test email from ERP', html: html || '<p>This is a test email from your ERP instance.</p>', text })
    return res.json({ ok: true, mailStatus })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Protected debug endpoint to check SendGrid API and SMTP connectivity from the host.
// Requires header `X-Debug-Token: <DEBUG_MAIL_TOKEN>` when `DEBUG_MAIL_TOKEN` is set in env.
app.post('/api/debug/sendgrid-check', async (req, res) => {
  try {
    const debugToken = process.env.DEBUG_MAIL_TOKEN || ''
    if (debugToken) {
      const provided = req.get('X-Debug-Token') || ''
      if (provided !== debugToken) return res.status(403).json({ message: 'Forbidden' })
    }

    const result = { webApi: null, smtp: null }

    // Check SendGrid Web API reachability
    try {
      if (!process.env.SENDGRID_API_KEY) {
        result.webApi = { ok: false, error: 'SENDGRID_API_KEY not set' }
      } else {
        const https = require('https')
        result.webApi = { ok: false }
        await new Promise((resolve) => {
          const opts = {
            hostname: 'api.sendgrid.com',
            port: 443,
            path: '/v3/user/account',
            method: 'GET',
            headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}` },
            timeout: 10000
          }
          const r = https.request(opts, (resp) => {
            let data = ''
            resp.on('data', (c) => { data += c })
            resp.on('end', () => {
              result.webApi.statusCode = resp.statusCode
              try { result.webApi.body = JSON.parse(data) } catch (e) { result.webApi.body = data }
              result.webApi.ok = resp.statusCode >= 200 && resp.statusCode < 300
              resolve()
            })
          })
          r.on('error', (e) => { result.webApi.error = String(e); resolve() })
          r.on('timeout', () => { result.webApi.error = 'timeout'; r.destroy(); resolve() })
          r.end()
        })
      }
    } catch (e) {
      result.webApi = { ok: false, error: e && (e.message || String(e)), stack: e && e.stack }
    }

    // Check SMTP connectivity using nodemailer.verify (if SMTP config present)
    try {
      if (!process.env.SMTP_HOST || !process.env.SMTP_PORT) {
        result.smtp = { ok: false, error: 'SMTP_HOST/SMTP_PORT not set' }
      } else {
        const nodemailer = require('nodemailer')
        const smtpOptions = {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
          auth: (process.env.SMTP_USER && process.env.SMTP_PASS) ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
          tls: { rejectUnauthorized: false }
        }
        const transporter = nodemailer.createTransport(smtpOptions)
        result.smtp = { ok: false }
        try {
          const info = await transporter.verify()
          result.smtp.ok = true
          result.smtp.info = info || null
        } catch (e) {
          result.smtp.ok = false
          result.smtp.error = e && (e.message || String(e))
          result.smtp.stack = e && e.stack
        }
      }
    } catch (e) {
      result.smtp = { ok: false, error: e && (e.message || String(e)), stack: e && e.stack }
    }

    return res.json({ ok: true, result })
  } catch (e) { return res.status(500).json({ message: e.message, stack: e.stack }) }
})

let dbConnected = false

// In-memory fallback storage for when MongoDB is not available (helps development without DB)
const inMemoryTests = []
const inMemoryQuestions = []
const inMemoryTestsResults = []

function makeId(prefix = '') {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`
}

// Register Mongoose connection event listeners
mongoose.connection.on('error', (err) => {
  console.error('Mongoose default connection error:', err)
})
mongoose.connection.on('disconnected', () => {
  console.warn('Mongoose default connection disconnected')
  dbConnected = false
})
mongoose.connection.on('connected', () => {
  console.log('Mongoose default connection connected')
  dbConnected = true
})

async function connectDb() {
  if (!MONGODB_URI) return
  const isProd = process.env.NODE_ENV === 'production'
  const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    socketTimeoutMS: 45000,          // Close sockets after 45s of inactivity
  }
  try {
    await mongoose.connect(MONGODB_URI, options)
    dbConnected = true
    console.log('Connected to MongoDB')

    // Log whether Razorpay env vars are present (mask the actual values)
    try {
      const rId = process.env.RAZORPAY_KEY_ID || ''
      const hasId = !!rId
      const maskedId = hasId ? (rId.slice(0, 8) + '...') : '<none>'
      const hasSecret = !!process.env.RAZORPAY_KEY_SECRET
      console.log('Razorpay config - keyIdPresent:', hasId, 'keyId(masked):', maskedId, 'secretPresent:', hasSecret)
    } catch (e) {
      // ignore
    }

    // Demo seeding: only run when `AUTO_SEED` env var is explicitly set to 'true'
    // This prevents accidental population of demo accounts on every server start.
    const AUTO_SEED = String(process.env.AUTO_SEED || '').toLowerCase() === 'true'
    if (AUTO_SEED) {
      try {
        // seed demo users if none exist
        const count = await User.countDocuments().catch(() => 0)
        if (count === 0) {
          console.log('Seeding demo users into MongoDB')
          const bcrypt = require('bcryptjs')
          const seed = demoUsers.map(u => ({ username: u.username, password: u.password, role: u.role, name: u.name }))
          await User.insertMany(seed)
        }

        // seed some demo students if none exist
        const sCount = await Student.countDocuments().catch(() => 0)
        if (sCount === 0) {
          console.log('Seeding demo students into MongoDB')
          const sample = []
          const sections = ['A', 'B', 'C']
          for (let cls = 1; cls <= 12; cls++) {
            for (let i = 1; i <= 3; i++) {
              const section = sections[(i - 1) % sections.length]
              sample.push({
                name: `Student ${cls}-${section}${i}`,
                email: `student${cls}${section}${i}@school.local`,
                class: String(cls),
                section,
                rollNo: `${cls}${section}${i}`,
              })
            }
          }
          await Student.insertMany(sample)
        }

        // seed demo faculty if none exist
        const fCount = await Faculty.countDocuments().catch(() => 0)
        if (fCount === 0) {
          console.log('Seeding demo faculty into MongoDB')
          const subjects = ['Math', 'Science', 'English', 'History', 'Computer']
          const sampleF = []
          for (let i = 1; i <= 12; i++) {
            sampleF.push({
              name: `Faculty ${i}`,
              email: `faculty${i}@school.local`,
              employeeId: `EMP${1000 + i}`,
              subject: subjects[i % subjects.length],
              contact: `+100000000${i}`,
            })
          }
          await Faculty.insertMany(sampleF)
        }
      } catch (e) {
        console.warn('Failed to auto-seed demo data:', e && e.message)
      }
    } else {
      console.log('AUTO_SEED not enabled — skipping demo data seeding')
    }
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message)
    dbConnected = false
    if (isProd) {
      console.error('FATAL ERROR: MongoDB connection failed in production. Exiting process.')
      process.exit(1)
    }
    // Common issue on Windows: `localhost` may resolve to IPv6 ::1 while mongod is listening on 127.0.0.1.
    // If the URI uses localhost, try again with 127.0.0.1 (IPv4) as a fallback.
    try {
      if (MONGODB_URI.includes('localhost')) {
        const alt = MONGODB_URI.replace('localhost', '127.0.0.1')
        console.log('Retrying MongoDB connection using', alt)
        await mongoose.connect(alt, options)
        dbConnected = true
        console.log('Connected to MongoDB (via 127.0.0.1)')
      }
    } catch (err2) {
      console.error('Retry with 127.0.0.1 failed:', err2.message)
      dbConnected = false
    }
  }
}

// attempt database connection (non-blocking)
connectDb()

// Basic health
app.get('/api/health', (req, res) => res.json({ ok: true, dbConnected }))

// Resolve current user's Faculty record
app.get('/api/faculty/me', verifyToken, async (req, res) => {
  try {
    const me = await User.findById(req.user.sub).lean().catch(() => null)
    if (!me) return res.status(404).json({ message: 'User not found' })
    let fac = await Faculty.findOne({ email: me.username }).lean().catch(() => null)
    if (!fac && me.name) fac = await Faculty.findOne({ name: me.name }).lean().catch(() => null)
    if (!fac && me.contact) fac = await Faculty.findOne({ contact: me.contact }).lean().catch(() => null)
    if (!fac) return res.status(404).json({ message: 'Faculty record not linked' })
    return res.json(fac)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ message: 'username and password required' })

  let user = null

  if (dbConnected) {
    // Try case-insensitive username lookup first
    const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    try {
      user = await User.findOne({ username: { $regex: `^${escapeRegExp(username)}$`, $options: 'i' } }).lean()
    } catch (e) {
      user = await User.findOne({ username }).lean().catch(() => null)
    }

    // Fallback: if not found, attempt to locate parent user by matching a student record
    // This helps when parents used their email (stored on Student) but parent User.username differs.
    if (!user) {
      try {
        const student = await Student.findOne({ $or: [{ email: username }, { rollNo: username }] }).lean().catch(() => null)
        if (student) {
          const candidates = await User.find({ parentOf: { $in: [String(student._id), student.email, student.rollNo, student.name] } }).lean().catch(() => [])
          if (candidates && candidates.length > 0) user = candidates[0]
        }
      } catch (e) {
        // ignore fallback errors
      }
    }

    if (user) user.id = user._id
  } else if (mongoose.connection.readyState === 1) {
    // DB is connected but dbConnected flag was false? Update it and try DB lookup.
    dbConnected = true;
    const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    try {
      user = await User.findOne({ username: { $regex: `^${escapeRegExp(username)}$`, $options: 'i' } }).lean()
    } catch (e) {
      user = await User.findOne({ username }).lean().catch(() => null)
    }
    if (user) user.id = user._id
  } else {
    user = findByUsername(username)
  }

  if (!user) {
    console.log(`Login failed: user ${username} not found (DB connected: ${dbConnected})`)
    return res.status(401).json({ message: 'User not found' })
  }

  // if user record has been disabled/blocked by admin, deny access
  try {
    if (user.disabled) return res.status(403).json({ message: 'Account blocked' })
  } catch (e) {
    // ignore if property missing
  }

  const passwordMatches = await bcrypt.compare(password, user.password)
  if (!passwordMatches) {
    console.log(`Login failed: password mismatch for ${username}`)
    return res.status(401).json({ message: 'Incorrect password' })
  }

  const payload = { sub: user.id, username: user.username, role: user.role, name: user.name }
  const secret = process.env.JWT_SECRET || 'change-this-secret'
  const token = jwt.sign(payload, secret, { expiresIn: process.env.JWT_EXPIRES || '2h' })

  // frontend can decide where to redirect; we include role and a suggested redirect path
  let redirect = '/'
  if (user.role === 'admin') redirect = '/admin-dashboard'
  if (user.role === 'faculty') redirect = '/faculty-dashboard'
  if (user.role === 'student') redirect = '/student-dashboard'
  if (user.role === 'parent') redirect = '/parents-dashboard'
  if (user.role === 'staff') redirect = '/staff-dashboard'

  return res.json({ token, role: user.role, redirect })
})

// register endpoint (creates user in DB if connected, otherwise in-memory)
app.post('/api/register', async (req, res) => {
  const { username, password, name, role = 'admin' } = req.body || {}
  if (!username || !password) return res.status(400).json({ message: 'username and password required' })

  // check existing
  // allow optional parent/profile fields during registration
  const { contact, address, parentOf, avatar } = req.body || {}
  if (dbConnected) {
    const exists = await User.findOne({ username }).lean()
    if (exists) return res.status(409).json({ message: 'User already exists' })
    const hashed = await bcrypt.hash(password, 10)
    const created = await User.create({ username, password: hashed, role, name, contact: contact || '', address: address || '', avatar: avatar || '', parentOf: parentOf || [] })
    return res.status(201).json({ id: created._id, username: created.username, role: created.role, name: created.name })
  } else {
    const { findByUsername, addUser } = require('./users')
    if (findByUsername(username)) return res.status(409).json({ message: 'User already exists' })
    const hashed = await bcrypt.hash(password, 10)
    const user = addUser({ username, password: hashed, role, name, contact: contact || '', address: address || '' })
    return res.status(201).json({ id: user.id, username: user.username, role: user.role, name: user.name })
  }
})

// logout (client-side token discard helper) - responds ok so clients can clear session
app.post('/api/logout', (req, res) => {
  // Nothing to do server-side for stateless JWTs, but return success for clients
  return res.json({ ok: true })
})

// Salary payment APIs (admin and faculty)
// ===================== Faculty Salary APIs =====================
// List all faculty (minimal fields)
app.get('/api/salary/faculties', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await Faculty.find({}, { name: 1, email: 1, employeeId: 1, subject: 1 }).lean().catch(() => [])
    return res.json(list)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Create a salary payment (mock Razorpay flow). If Razorpay env exists, we still mock success for test.
app.post('/api/salary/pay', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { facultyId, month, amount } = req.body || {}
    if (!facultyId || !month || !amount) return res.status(400).json({ message: 'facultyId, month, amount required' })
    const fac = await Faculty.findById(facultyId).lean().catch(() => null)
    if (!fac) return res.status(404).json({ message: 'Faculty not found' })

    // Create payment record as pending first
    let payment = await SalaryPayment.create({
      facultyId,
      facultyName: fac.name,
      facultyEmail: fac.email,
      month,
      amount,
      status: 'pending',
    })

    // Mock Razorpay order/payment success
    const razorpayOrderId = 'order_' + makeId('rz_')
    const razorpayPaymentId = 'pay_' + makeId('rz_')
    const razorpaySignature = makeId('sig_')

    // Generate a simple receipt number
    const receiptNo = `SAL-${new Date().getFullYear()}-${String(payment._id).slice(-6).toUpperCase()}`

    payment.razorpayOrderId = razorpayOrderId
    payment.razorpayPaymentId = razorpayPaymentId
    payment.razorpaySignature = razorpaySignature
    payment.receiptNo = receiptNo
    payment.status = 'paid'
    await payment.save()

    return res.status(201).json(payment)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Create Razorpay order (optional real test). Returns order payload for Checkout.
app.post('/api/salary/order', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { facultyId, month, amount } = req.body || {}
    if (!facultyId || !month || !amount) return res.status(400).json({ message: 'facultyId, month, amount required' })
    const fac = await Faculty.findById(facultyId).lean().catch(() => null)
    if (!fac) return res.status(404).json({ message: 'Faculty not found' })

    const amountPaise = Math.round(Number(amount) * 100)
    const receipt = `SAL-${new Date().getFullYear()}-${makeId('r_')}`

    if (razorpayClient) {
      try {
        const order = await razorpayClient.orders.create({ amount: amountPaise, currency: 'INR', receipt, notes: { facultyId: String(fac._id), month } })
        return res.json({ mode: 'razorpay', order, faculty: { id: fac._id, name: fac.name, email: fac.email }, receipt })
      } catch (e) {
        // fall through to mock
        console.warn('Razorpay order create failed, falling back to mock:', e.message)
      }
    }
    // Mock order payload for test
    const order = { id: 'order_' + makeId('rz_'), amount: amountPaise, currency: 'INR', receipt, status: 'created' }
    return res.json({ mode: 'mock', order, faculty: { id: fac._id, name: fac.name, email: fac.email }, receipt })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Capture/verify payment and persist receipt. Frontend sends order/payment ids.
app.post('/api/salary/confirm', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { facultyId, month, amount, orderId, paymentId, signature } = req.body || {}
    if (!facultyId || !month || !amount || !orderId || !paymentId) return res.status(400).json({ message: 'required fields missing' })
    const fac = await Faculty.findById(facultyId).lean().catch(() => null)
    if (!fac) return res.status(404).json({ message: 'Faculty not found' })

    let payment = await SalaryPayment.create({
      facultyId,
      facultyName: fac.name,
      facultyEmail: fac.email,
      month,
      amount,
      status: 'paid',
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature || '',
      receiptNo: `SAL-${new Date().getFullYear()}-${String(makeId()).slice(-6).toUpperCase()}`,
    })
    return res.status(201).json(payment)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// List all salary payments (admin)
app.get('/api/salary/payments', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await SalaryPayment.find().sort({ createdAt: -1 }).lean().catch(() => [])
    return res.json(list)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Faculty: my salary payments
app.get('/api/salary/my', verifyToken, requireRole('faculty'), async (req, res) => {
  try {
    // Resolve faculty record for current user
    const meUser = await User.findById(req.user.sub).lean().catch(() => null)
    if (!meUser) return res.status(404).json({ message: 'User not found' })
    let fac = await Faculty.findOne({ email: meUser.username }).lean().catch(() => null)
    if (!fac && meUser.name) fac = await Faculty.findOne({ name: meUser.name }).lean().catch(() => null)
    if (!fac && meUser.contact) fac = await Faculty.findOne({ contact: meUser.contact }).lean().catch(() => null)
    if (!fac) return res.status(404).json({ message: 'Faculty record not linked' })

    const list = await SalaryPayment.find({ facultyId: fac._id }).sort({ createdAt: -1 }).lean().catch(() => [])
    return res.json(list)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Generate simple HTML receipt for a salary payment (downloadable via browser)
app.get('/api/salary/receipt/:id', verifyToken, async (req, res) => {
  try {
    const id = req.params.id
    const pay = await SalaryPayment.findById(id).lean().catch(() => null)
    if (!pay) return res.status(404).send('Receipt not found')
    // AuthZ: allow admin; allow the specific faculty for whom this receipt belongs
    const role = req.user && req.user.role
    let allowed = role === 'admin'
    if (!allowed) {
      try {
        const meUser = await User.findById(req.user.sub).lean().catch(() => null)
        let fac = null
        if (meUser) {
          fac = await Faculty.findOne({ $or: [{ email: meUser.username }, { name: meUser.name }, { contact: meUser.contact }] }).lean().catch(() => null)
        }
        if (fac && String(fac._id) === String(pay.facultyId)) allowed = true
      } catch {}
    }
    if (!allowed) return res.status(403).send('Forbidden')
    // Avoid referencing undefined variables (was logging `origins` here and
    // causing a ReferenceError in some deployments). Keep a simple debug log.
    console.debug('Generating HTML salary receipt for id:', id)
    const issued = new Date(pay.createdAt || Date.now()).toLocaleString()
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
    <div class="head">Salary Receipt</div>
    <div class="content">
      <div class="row"><div>Receipt No</div><div><strong>${pay.receiptNo || '-'}</strong></div></div>
      <div class="row"><div>Faculty</div><div>${pay.facultyName || ''}</div></div>
      <div class="row"><div>Month</div><div>${pay.month || ''}</div></div>
      <div class="row"><div>Status</div><div><span class="tag">${pay.status || ''}</span></div></div>
      <div class="row"><div>Amount</div><div class="amount">₹${pay.amount || 0}</div></div>
      <div class="row muted"><div>Order ID</div><div>${pay.razorpayOrderId || '-'}</div></div>
      <div class="row muted"><div>Payment ID</div><div>${pay.razorpayPaymentId || '-'}</div></div>
      <div class="row muted"><div>Signature</div><div>${pay.razorpaySignature || '-'}</div></div>
      <div class="row muted"><div>Issued</div><div>${issued}</div></div>
    </div>
    <div class="footer">
      <div>Generated by ERP Salary Module</div>
      <a class="btn" href="javascript:window.print()">Print / Save PDF</a>
    </div>
  </div>
</body></html>`

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.send(html)
  } catch (e) { return res.status(500).send('Failed to generate receipt') }
})

// PDF receipt (application/pdf). Requires pdfkit installed; otherwise returns 501.
app.get('/api/salary/receipt/:id.pdf', verifyToken, async (req, res) => {
  try {
    if (!PDFDocument) {
      res.status(501)
      return res.json({ message: 'PDF generation not available. Please install pdfkit on the server.' })
    }
    const id = req.params.id
    const pay = await SalaryPayment.findById(id).lean().catch(() => null)
    if (!pay) return res.status(404).json({ message: 'Receipt not found' })
    // AuthZ: admin or specific faculty
    const role = req.user && req.user.role
    let allowed = role === 'admin'
    if (!allowed) {
      try {
        const meUser = await User.findById(req.user.sub).lean().catch(() => null)
        let fac = null
        if (meUser) {
          fac = await Faculty.findOne({ $or: [{ email: meUser.username }, { name: meUser.name }, { contact: meUser.contact }] }).lean().catch(() => null)
        }
        if (fac && String(fac._id) === String(pay.facultyId)) allowed = true
      } catch {}
    }
    if (!allowed) return res.status(403).json({ message: 'Forbidden' })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="receipt_${pay.receiptNo || id}.pdf"`)

    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    doc.pipe(res)

    // Header
    doc.rect(0, 0, doc.page.width, 70).fill('#111827')
    doc.fill('#ffffff').fontSize(20).font('Helvetica-Bold').text('Salary Receipt', 50, 25)

    doc.moveDown(2)
    doc.fill('#000000')
    doc.font('Helvetica')

    const issued = new Date(pay.createdAt || Date.now()).toLocaleString()
    const rows = [
      ['Receipt No', pay.receiptNo || '-'],
      ['Faculty', pay.facultyName || ''],
      ['Month', pay.month || ''],
      ['Status', pay.status || ''],
      ['Amount', `₹${pay.amount || 0}`],
      ['Order ID', pay.razorpayOrderId || '-'],
      ['Payment ID', pay.razorpayPaymentId || '-'],
      ['Signature', pay.razorpaySignature || '-'],
      ['Issued', issued],
    ]

    // Table-like layout
    let y = 120
    const labelX = 50
    const valueX = 220
    rows.forEach(([label, value], idx) => {
      doc.font('Helvetica-Bold').text(label, labelX, y)
      doc.font('Helvetica').text(String(value), valueX, y)
      y += 24
    })

    doc.moveDown(2)
    doc.fontSize(10).fill('#374151').text('Generated by ERP Salary Module', 50, y + 10)

    doc.end()
  } catch (e) { return res.status(500).json({ message: 'Failed to generate PDF' }) }
})

// ===================== Staff Salary APIs (admin) =====================
// List all staff users (minimal fields)
app.get('/api/staff-salary/staff', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await User.find({ role: 'staff' }, { name: 1, username: 1, contact: 1 }).lean().catch(() => [])
    return res.json(list)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Create a staff salary payment (mock Razorpay flow)
app.post('/api/staff-salary/pay', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { userId, month, amount } = req.body || {}
    if (!userId || !month || !amount) return res.status(400).json({ message: 'userId, month, amount required' })
    const staff = await User.findById(userId).lean().catch(() => null)
    if (!staff || staff.role !== 'staff') return res.status(404).json({ message: 'Staff not found' })

    let payment = await StaffSalaryPayment.create({
      userId,
      staffName: staff.name || staff.username,
      staffEmail: staff.username || '',
      month,
      amount,
      status: 'pending',
    })

    const razorpayOrderId = 'order_' + makeId('rz_')
    const razorpayPaymentId = 'pay_' + makeId('rz_')
    const razorpaySignature = makeId('sig_')
    const receiptNo = `SSL-${new Date().getFullYear()}-${String(payment._id).slice(-6).toUpperCase()}`

    payment.razorpayOrderId = razorpayOrderId
    payment.razorpayPaymentId = razorpayPaymentId
    payment.razorpaySignature = razorpaySignature
    payment.receiptNo = receiptNo
    payment.status = 'paid'
    await payment.save()

    return res.status(201).json(payment)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Generate a pending staff salary slip for tracking before payment
app.post('/api/staff-salary/slips', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { userId, month, basic = 0, allowances = 0, deductions = 0, amount, notes = '' } = req.body || {}
    if (!userId || !month) return res.status(400).json({ message: 'userId and month required' })
    const staff = await User.findById(userId).lean().catch(() => null)
    if (!staff || staff.role !== 'staff') return res.status(404).json({ message: 'Staff not found' })

    const basicNum = Number(basic || 0)
    const allowancesNum = Number(allowances || 0)
    const deductionsNum = Number(deductions || 0)
    const totalAmount = amount !== undefined && amount !== '' ? Number(amount || 0) : Math.max(0, basicNum + allowancesNum - deductionsNum)
    if (!totalAmount || totalAmount < 0) return res.status(400).json({ message: 'Valid salary amount required' })

    const slip = await StaffSalaryPayment.create({
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
      receiptNo: `SSL-${new Date().getFullYear()}-${String(makeId()).slice(-6).toUpperCase()}`,
    })
    return res.status(201).json(slip)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Mark an existing staff salary slip as paid
app.patch('/api/staff-salary/payments/:id/mark-paid', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const id = req.params.id
    const { paymentMethod = 'Cash', paymentDate, notes } = req.body || {}
    const pay = await StaffSalaryPayment.findById(id).catch(() => null)
    if (!pay) return res.status(404).json({ message: 'Salary slip not found' })
    pay.status = 'paid'
    pay.paymentMethod = String(paymentMethod || 'Cash')
    pay.paymentDate = paymentDate ? new Date(paymentDate) : new Date()
    if (notes !== undefined) pay.notes = String(notes || '')
    if (!pay.receiptNo) pay.receiptNo = `SSL-${new Date().getFullYear()}-${String(pay._id).slice(-6).toUpperCase()}`
    if (!pay.razorpayPaymentId) pay.razorpayPaymentId = `manual_${makeId('pay_')}`
    await pay.save()
    return res.json(pay)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Create Razorpay order for staff salary
app.post('/api/staff-salary/order', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { userId, month, amount } = req.body || {}
    if (!userId || !month || !amount) return res.status(400).json({ message: 'userId, month, amount required' })
    const staff = await User.findById(userId).lean().catch(() => null)
    if (!staff || staff.role !== 'staff') return res.status(404).json({ message: 'Staff not found' })

    const amountPaise = Math.round(Number(amount) * 100)
    const receipt = `SSL-${new Date().getFullYear()}-${makeId('r_')}`

    if (razorpayClient) {
      try {
        const order = await razorpayClient.orders.create({ amount: amountPaise, currency: 'INR', receipt, notes: { userId: String(staff._id), month } })
        return res.json({ mode: 'razorpay', order, staff: { id: staff._id, name: staff.name || staff.username, email: staff.username || '' }, receipt })
      } catch (e) {
        console.warn('Razorpay order create failed (staff), falling back to mock:', e.message)
      }
    }
    const order = { id: 'order_' + makeId('rz_'), amount: amountPaise, currency: 'INR', receipt, status: 'created' }
    return res.json({ mode: 'mock', order, staff: { id: staff._id, name: staff.name || staff.username, email: staff.username || '' }, receipt })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Confirm staff salary payment and persist receipt
app.post('/api/staff-salary/confirm', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { userId, month, amount, orderId, paymentId, signature } = req.body || {}
    if (!userId || !month || !amount || !orderId || !paymentId) return res.status(400).json({ message: 'required fields missing' })
    const staff = await User.findById(userId).lean().catch(() => null)
    if (!staff || staff.role !== 'staff') return res.status(404).json({ message: 'Staff not found' })

    let payment = await StaffSalaryPayment.create({
      userId,
      staffName: staff.name || staff.username,
      staffEmail: staff.username || '',
      month,
      amount,
      status: 'paid',
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature || '',
      receiptNo: `SSL-${new Date().getFullYear()}-${String(makeId()).slice(-6).toUpperCase()}`,
    })
    return res.status(201).json(payment)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// List all staff salary payments
app.get('/api/staff-salary/payments', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await StaffSalaryPayment.find().sort({ createdAt: -1 }).lean().catch(() => [])
    return res.json(list)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Staff: my staff salary payments
app.get('/api/staff-salary/my-payments', verifyToken, requireRole('staff'), async (req, res) => {
  try {
    const userId = String(req.user && req.user.sub)
    const list = await StaffSalaryPayment.find({ userId }).sort({ createdAt: -1 }).lean().catch(() => [])
    return res.json(list)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Generate HTML receipt for staff salary payment (admin or owning staff)
app.get('/api/staff-salary/receipt/:id', verifyToken, async (req, res) => {
  try {
    const id = req.params.id
    const pay = await StaffSalaryPayment.findById(id).lean().catch(() => null)
    if (!pay) return res.status(404).send('Receipt not found')
    const isAdmin = req.user && req.user.role === 'admin'
    const isOwner = req.user && String(req.user.sub) === String(pay.userId)
    if (!isAdmin && !isOwner) return res.status(403).send('Forbidden')
    const uid = (pay.userId || '').toString()
    const staffIdDisplay = uid ? `STF-${uid.slice(-6).toUpperCase()}` : '-'
    const issued = new Date(pay.createdAt || Date.now()).toLocaleString()
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
</body></html>`

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.send(html)
  } catch (e) { return res.status(500).send('Failed to generate receipt') }
})

// Staff/Admin: PDF receipt for staff salary payment
app.get('/api/staff-salary/receipt/:id.pdf', verifyToken, async (req, res) => {
  try {
    const id = req.params.id
    const pay = await StaffSalaryPayment.findById(id).lean().catch(() => null)
    if (!pay) return res.status(404).json({ message: 'Receipt not found' })

    const isAdmin = req.user && req.user.role === 'admin'
    const isOwner = req.user && String(req.user.sub) === String(pay.userId)
    if (!isAdmin && !isOwner) return res.status(403).json({ message: 'Forbidden' })

    let PDFDocument
    try { PDFDocument = require('pdfkit') } catch {
      return res.status(501).json({ message: 'PDF generation not available' })
    }
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="staff_receipt_${pay.receiptNo || id}.pdf"`)
    const doc = new PDFDocument({ size: 'A4', margin: 40 })
    doc.pipe(res)

    // header
    doc.rect(40, 20, 515, 40).fill('#111827')
    doc.fill('#ffffff').fontSize(20).font('Helvetica-Bold').text('Staff Salary Receipt', 50, 25)
    doc.fill('#111827')

    const issued = new Date(pay.createdAt || Date.now()).toLocaleString()
    const uid = (pay.userId || '').toString()
    const staffIdDisplay = uid ? `STF-${uid.slice(-6).toUpperCase()}` : '-'
    const rows = [
      ['Receipt No', pay.receiptNo || '-'],
      ['Staff', pay.staffName || '-'],
      ['Staff ID', staffIdDisplay],
      ['Month', pay.month || '-'],
      ['Status', pay.status || '-'],
      ['Amount', `₹${pay.amount || 0}`],
      ['Order ID', pay.razorpayOrderId || '-'],
      ['Payment ID', pay.razorpayPaymentId || '-'],
      ['Signature', pay.razorpaySignature || '-'],
      ['Issued', issued],
    ]
    let y = 80
    const labelX = 50, valueX = 220
    doc.fontSize(12)
    rows.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').text(String(label), labelX, y)
      doc.font('Helvetica').text(String(value), valueX, y)
      y += 24
    })

    doc.moveDown(2)
    doc.fontSize(10).fill('#374151').text('Generated by ERP Staff Salary Module', 50, y + 10)

    doc.end()
  } catch (e) { return res.status(500).json({ message: 'Failed to generate PDF' }) }
})

// Faculty registration endpoint (public) - stores registration for admin approval
app.post('/api/faculty/register', async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { name, email, subject, education, contact, avatar, experience, classGrade, houses } = req.body || {}
    if (!name || !email) return res.status(400).json({ message: 'name and email required' })
    const exists = await FacultyRegistration.findOne({ email }).lean().catch(() => null)
    if (exists && exists.status === 'pending') return res.status(409).json({ message: 'Registration already submitted' })
    const reg = await FacultyRegistration.create({ name, email, subject, education, contact, avatar, experience, classGrade, houses: Array.isArray(houses) ? houses : [], status: 'pending' })
    // send notification email to admin
    try {
      const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER || null
      if (adminEmail) {
        const subjectAdmin = `New faculty registration: ${name}`
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
        `
        sendMail({ to: adminEmail, subject: subjectAdmin, html: htmlAdmin }).catch(() => {})
      }
    } catch (mailErr) {
      console.warn('Failed to notify admin of registration:', mailErr && (mailErr.message || String(mailErr)))
    }

    // emit SSE event for admin UIs
    try { sendSseEvent('faculty_registration', { id: reg._id, name: reg.name, email: reg.email }) } catch (e) {}

    return res.status(201).json(reg)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Student registration (public) -> admin approval
app.post('/api/students/register', async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { name, email, class: className, address, school, accessId, avatar, medium } = req.body || {}
    if (!name || !email) return res.status(400).json({ message: 'name and email required' })
    const exists = await StudentRegistration.findOne({ email }).lean().catch(() => null)
    if (exists && exists.status === 'pending') return res.status(409).json({ message: 'Registration already submitted' })
    const reg = await StudentRegistration.create({ name, email, class: className, medium: medium || 'English', address, school, accessId: accessId || '123', avatar, status: 'pending' })

    // notify admin by email
    try {
      const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER || null
      if (adminEmail) {
        const subjectAdmin = `New student registration: ${name}`
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
        `
        sendMail({ to: adminEmail, subject: subjectAdmin, html: htmlAdmin }).catch(() => {})
      }
    } catch (mailErr) { console.warn('Failed to notify admin of student registration:', mailErr && (mailErr.message || String(mailErr))) }

    // SSE
    try { sendSseEvent('student_registration', { id: reg._id, name: reg.name, email: reg.email, class: reg.class }) } catch (e) {}

    return res.status(201).json(reg)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Admin: list student registrations
app.get('/api/students/registrations', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { status } = req.query || {}
    const q = {}
    if (status) q.status = status
    const items = await StudentRegistration.find(q).sort({ createdAt: -1 }).lean()
    return res.json(items)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Faculty/Admin: list students by class/section
app.get('/api/students', verifyToken, requireRole(['admin','faculty']), async (req, res, next) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { class: cls, section, name, email, house, stream } = req.query || {}
    // If advanced filters are present, defer to the enhanced handler defined later
    if (name || email || house) return next()
    const q = {}
    if (cls) q.class = String(cls)
    if (section) q.section = String(section)
    if (stream) q.stream = String(stream)
    const items = await Student.find(q).sort({ class: 1, section: 1, rollNo: 1 }).lean()
    return res.json(items)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// NOTE: Student route consolidated earlier. Removed duplicate handler to avoid
// multiple handlers for the same path which can produce unexpected behavior.

// Student: get or generate parent access code for the logged-in student
app.get('/api/students/parent-code', verifyToken, requireRole('student'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const s = await Student.findOne({ email: req.user.username })
    if (!s) return res.status(404).json({ message: 'Student record not found' })
    if (!s.parentAccessCode) {
      s.parentAccessCode = generateParentCode()
      await s.save()
    }
    return res.json({ code: s.parentAccessCode })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Attendance endpoints
app.post('/api/attendance', verifyToken, requireRole(['faculty','admin']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { class: cls, section, date, records } = req.body || {}
    if (!cls || !date || !Array.isArray(records)) return res.status(400).json({ message: 'class, date and records required' })
    // prevent future dates
    const today = new Date(); today.setHours(0,0,0,0)
    const supplied = new Date(date); supplied.setHours(0,0,0,0)
    if (supplied > today) return res.status(400).json({ message: 'Cannot mark attendance for future dates' })

    // If the caller is a faculty, ensure they are assigned to this class/section
    if (req.user && req.user.role === 'faculty') {
      const u = await User.findById(req.user.sub).lean().catch(() => null)
      if (!u) return res.status(403).json({ message: 'Unauthorized' })
      let fac = await Faculty.findOne({ email: u.username }).lean().catch(() => null)
      if (!fac && u.name) fac = await Faculty.findOne({ name: u.name }).lean().catch(() => null)
      if (!fac && u.contact) fac = await Faculty.findOne({ contact: u.contact }).lean().catch(() => null)
      if (!fac) return res.status(403).json({ message: 'Faculty record not linked' })
      const clsStr = String(cls)
      const secStr = String(section || '')
      let allowed = false
      for (const a of fac.assignments || []) {
        if (String(a.class) !== clsStr) continue
        if (a.isClassTeacher) { allowed = true; break }
        if (a.section && String(a.section) === secStr) { allowed = true; break }
      }
      if (!allowed) return res.status(403).json({ message: 'Not assigned to this class/section' })
    }

    const q = { class: String(cls), section: section || '', date: String(date) }
    // ensure each record has markedBy set to current user
    const enriched = (records || []).map(r => ({ studentId: r.studentId, status: r.status || 'present', markedBy: req.user.sub }))

    // Validate that supplied student IDs belong to the requested class/section
    try {
      const ids = (enriched || []).map(r => String(r.studentId)).filter(Boolean)
      if (ids.length > 0) {
        const studs = await Student.find({ _id: { $in: ids } }).lean()
        if (!studs || studs.length !== ids.length) return res.status(400).json({ message: 'Some student records not found' })
        for (const s of studs) {
          if (String(s.class) !== String(cls)) return res.status(400).json({ message: `Student ${s._id} not in class ${cls}` })
          if (section && String(section || '') !== '' && String(s.section || '') !== String(section || '')) return res.status(400).json({ message: `Student ${s._id} not in section ${section}` })
        }
      }
    } catch (valErr) {
      return res.status(400).json({ message: valErr && valErr.message ? valErr.message : 'Invalid student data' })
    }
    // upsert: replace records if exists
    let att = await Attendance.findOne(q)
    // build a map of previous statuses to detect changes for emails
    const previousMap = {}
    if (att && Array.isArray(att.records)) {
      for (const r of att.records) previousMap[String(r.studentId)] = r.status
    }
    if (att) {
      att.records = enriched
      att.createdBy = req.user.sub
      await att.save()
    } else {
      att = await Attendance.create({ class: String(cls), section: section || '', date: String(date), records: enriched, createdBy: req.user.sub })
    }

    // Emit SSE so admin/faculty dashboards can refresh in real-time
    try { sendSseEvent('attendance_updated', { type: 'student', class: String(cls), section: String(section || ''), date: String(date), count: enriched.length, byRole: req.user && req.user.role }) } catch (e) {}

    // Send email notifications to students for new/changed statuses (best-effort)
    try {
      const changed = []
      for (const r of enriched) {
        const sid = String(r.studentId)
        const before = previousMap[sid]
        if (!before || before !== r.status) changed.push(r)
      }
      // if new attendance (no previous), send for all
      const toNotify = Object.keys(previousMap).length === 0 ? enriched : changed
      if (toNotify.length > 0) {
        // fetch students in one query
        const ids = toNotify.map(r => r.studentId)
        const students = await Student.find({ _id: { $in: ids } }).lean()
        const byId = {}
        students.forEach(s => { byId[String(s._id)] = s })
        const titleDate = String(date)
        const classLabel = `Class ${String(cls)}${section ? ' - Section ' + String(section) : ''}`
        for (const r of toNotify) {
          const s = byId[String(r.studentId)]
          if (!s || !s.email) continue
          const statusWord = r.status === 'present' ? 'Present' : 'Absent'
          const subject = `Attendance marked for ${titleDate}: ${statusWord}`
          const html = `
            <div style="font-family:Inter,Arial,sans-serif;background:#f6f7fb;padding:20px;color:#111">
              <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:10px;overflow:hidden">
                <div style="background:linear-gradient(90deg,#06b6d4,#7c3aed);color:#fff;padding:16px 20px">
                  <h2 style="margin:0;font-size:18px">Attendance Update — ${titleDate}</h2>
                </div>
                <div style="padding:16px 20px;line-height:1.6">
                  <p style="margin:0 0 8px">Hello ${s.name || 'Student'},</p>
                  <p style="margin:0 0 8px">Your attendance has been marked as <strong>${statusWord}</strong> for ${classLabel} on <strong>${titleDate}</strong>.</p>
                  <p style="margin:8px 0 0;color:#6b7280;font-size:13px">This is an automated notification from the ERP system.</p>
                </div>
              </div>
            </div>
          `
          // fire and forget
          notifyEvent({
            event: 'attendance_marked',
            phone: s.contact,
            message: `Attendance update: ${statusWord} on ${titleDate} for ${classLabel}`,
            emailOpts: { to: s.email, subject, html }
          }).catch(() => {})
        }
      }
    } catch (mailErr) {
      console.warn('Attendance email notify failed:', mailErr && (mailErr.message || String(mailErr)))
    }

    return res.status(201).json(att)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.get('/api/attendance', verifyToken, requireRole(['admin','faculty','student','parent']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { class: cls, section, date } = req.query || {}
    const q = {}
    if (cls) q.class = String(cls)
    if (section) q.section = String(section)
    if (date) q.date = String(date)
    const items = await Attendance.find(q).sort({ date: -1 }).lean()
    return res.json(items)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Export student attendance history as CSV
app.get('/api/attendance/export', verifyToken, requireRole(['admin','faculty','student','parent']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { class: cls, section, studentId: rawStudentId, from, to } = req.query || {}
    const role = req.user && req.user.role
    let effectiveStudentId = rawStudentId || null
    // Restrict access per role
    if (role === 'student') {
      const me = await Student.findOne({ email: req.user.username }).lean().catch(() => null)
      if (!me) return res.status(404).json({ message: 'Student record not found' })
      effectiveStudentId = String(me._id)
    } else if (role === 'parent') {
      if (!rawStudentId) return res.status(400).json({ message: 'studentId required for parent' })
      const user = await User.findById(req.user.sub).lean().catch(() => null)
      if (!user || user.role !== 'parent') return res.status(403).json({ message: 'Unauthorized' })
      const allowed = Array.isArray(user.parentOf) && user.parentOf.some(x => String(x) === String(rawStudentId))
      if (!allowed) return res.status(403).json({ message: 'Not linked to this student' })
      effectiveStudentId = String(rawStudentId)
    }
    const q = {}
    if (cls) q.class = String(cls)
    if (section) q.section = String(section)
    if (from || to) {
      q.date = {}
      if (from) q.date.$gte = String(from)
      if (to) q.date.$lte = String(to)
    }
    const items = await Attendance.find(q).sort({ date: 1 }).lean()
    // collect student ids present
    const ids = new Set()
    ;(items || []).forEach(it => {
      ;(it.records || []).forEach(r => {
        if (!effectiveStudentId || String(r.studentId) === String(effectiveStudentId)) ids.add(String(r.studentId))
      })
    })
    // fetch student details for nice CSV
    const byId = {}
    if (ids.size > 0) {
      const docs = await Student.find({ _id: { $in: Array.from(ids) } }).lean()
      ;(docs || []).forEach(s => { byId[String(s._id)] = s })
    }
    const rows = [['Date','Class','Section','StudentId','StudentName','Roll','Status']]
    ;(items || []).forEach(it => {
      ;(it.records || []).forEach(r => {
        if (effectiveStudentId && String(r.studentId) !== String(effectiveStudentId)) return
        const s = byId[String(r.studentId)]
        rows.push([
          String(it.date || ''),
          String(it.class || ''),
          String(it.section || ''),
          String(r.studentId || ''),
          s && s.name ? String(s.name) : '',
          s && s.rollNo ? String(s.rollNo) : '',
          String(r.status || '')
        ])
      })
    })
    const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n')
    const fnameParts = ['attendance_students']
    if (cls) fnameParts.push(`class-${String(cls)}`)
    if (section) fnameParts.push(`section-${String(section)}`)
    if (effectiveStudentId) fnameParts.push(`student-${String(effectiveStudentId).slice(-6)}`)
    if (from) fnameParts.push(`from-${String(from)}`)
    if (to) fnameParts.push(`to-${String(to)}`)
    const filename = fnameParts.join('_') + '.csv'
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.status(200).send(csv)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Faculty attendance endpoints
app.post('/api/attendance/faculty', verifyToken, requireRole(['faculty','admin']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { date, records } = req.body || {}
    if (!date || !Array.isArray(records)) return res.status(400).json({ message: 'date and records required' })
    const today = new Date(); today.setHours(0,0,0,0)
    const supplied = new Date(date); supplied.setHours(0,0,0,0)
    if (supplied > today) return res.status(400).json({ message: 'Cannot mark attendance for future dates' })
    let att = await FacultyAttendance.findOne({ date: String(date) })
    const enriched = (records || []).map(r => ({ facultyId: r.facultyId, status: r.status || 'present', markedBy: req.user.sub }))
    if (att) {
      att.records = enriched
      att.createdBy = req.user.sub
      await att.save()
    } else {
      att = await FacultyAttendance.create({ date: String(date), records: enriched, createdBy: req.user.sub })
    }
    // SSE notify for faculty attendance updates
    try { sendSseEvent('attendance_updated', { type: 'faculty', date: String(date), count: enriched.length, byRole: req.user && req.user.role }) } catch (e) {}
    return res.status(201).json(att)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.get('/api/attendance/faculty', verifyToken, requireRole(['admin','faculty']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { date } = req.query || {}
    const q = {}
    if (date) q.date = String(date)
    const items = await FacultyAttendance.find(q).sort({ date: -1 }).lean()
    return res.json(items)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Export faculty attendance history as CSV
app.get('/api/attendance/faculty/export', verifyToken, requireRole(['admin','faculty']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { facultyId, from, to } = req.query || {}
    const q = {}
    if (from || to) {
      q.date = {}
      if (from) q.date.$gte = String(from)
      if (to) q.date.$lte = String(to)
    }
    const items = await FacultyAttendance.find(q).sort({ date: 1 }).lean()
    const ids = new Set()
    ;(items || []).forEach(it => {
      ;(it.records || []).forEach(r => {
        if (!facultyId || String(r.facultyId) === String(facultyId)) ids.add(String(r.facultyId))
      })
    })
    const fById = {}
    if (ids.size > 0) {
      const docs = await Faculty.find({ _id: { $in: Array.from(ids) } }).lean()
      ;(docs || []).forEach(f => { fById[String(f._id)] = f })
    }
    const rows = [['Date','FacultyId','Name','EmployeeId','Subject','Status']]
    ;(items || []).forEach(it => {
      ;(it.records || []).forEach(r => {
        if (facultyId && String(r.facultyId) !== String(facultyId)) return
        const f = fById[String(r.facultyId)]
        rows.push([
          String(it.date || ''),
          String(r.facultyId || ''),
          f && f.name ? String(f.name) : '',
          f && f.employeeId ? String(f.employeeId) : '',
          f && f.subject ? String(f.subject) : '',
          String(r.status || '')
        ])
      })
    })
    const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n')
    const fnameParts = ['attendance_faculty']
    if (facultyId) fnameParts.push(`faculty-${String(facultyId).slice(-6)}`)
    if (from) fnameParts.push(`from-${String(from)}`)
    if (to) fnameParts.push(`to-${String(to)}`)
    const filename = fnameParts.join('_') + '.csv'
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.status(200).send(csv)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Marks endpoints (basic create/update/list)
app.post('/api/marks', verifyToken, requireRole('faculty'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { class: cls, section, studentId, subject, total, obtained, term } = req.body || {}
    if (!cls || !studentId || subject === undefined || obtained === undefined) return res.status(400).json({ message: 'class, studentId, subject, obtained required' })
    // Ensure faculty is assigned to this class/section and student belongs to it
    if (req.user && req.user.role === 'faculty') {
      const u = await User.findById(req.user.sub).lean().catch(() => null)
      if (!u) return res.status(403).json({ message: 'Unauthorized' })
      let fac = await Faculty.findOne({ email: u.username }).lean().catch(() => null)
      if (!fac && u.name) fac = await Faculty.findOne({ name: u.name }).lean().catch(() => null)
      if (!fac && u.contact) fac = await Faculty.findOne({ contact: u.contact }).lean().catch(() => null)
      if (!fac) return res.status(403).json({ message: 'Faculty record not linked' })
      const clsStr = String(cls)
      const secStr = String(section || '')
      let allowed = false
      for (const a of fac.assignments || []) {
        if (String(a.class) !== clsStr) continue
        if (a.isClassTeacher) { allowed = true; break }
        if (a.section && String(a.section) === secStr) { allowed = true; break }
      }
      if (!allowed) return res.status(403).json({ message: 'Not assigned to this class/section' })
      // validate student belongs to class/section
      const sdoc = await Student.findById(studentId).lean().catch(() => null)
      if (!sdoc) return res.status(400).json({ message: 'Student not found' })
      if (String(sdoc.class) !== clsStr) return res.status(400).json({ message: `Student ${studentId} not in class ${cls}` })
      if (section && String(sdoc.section || '') !== secStr) return res.status(400).json({ message: `Student ${studentId} not in section ${section}` })
    }
    // Prevent duplicate: if a mark exists for student+subject+term, update it instead
    const existing = await Mark.findOne({ studentId, subject, term: term || '' })
    if (existing) {
      existing.obtained = Number(obtained)
      if (total !== undefined) existing.total = Number(total)
      existing.class = String(cls)
      existing.section = section || ''
      existing.createdBy = req.user.sub
      await existing.save()
      return res.json(existing)
    }
    const m = await Mark.create({ class: String(cls), section: section || '', studentId, subject, total: Number(total || 0), obtained: Number(obtained), term: term || '', createdBy: req.user.sub })
    return res.status(201).json(m)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Bulk upsert marks: accepts array of marks
app.post('/api/marks/bulk', verifyToken, requireRole('faculty'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const items = Array.isArray(req.body) ? req.body : (req.body && req.body.marks) || []
    if (!items.length) return res.status(400).json({ message: 'marks array required' })
    const results = []
    for (const it of items) {
      const { class: cls, section, studentId, subject, total, obtained, term } = it || {}
      if (!studentId || subject === undefined || obtained === undefined) continue
      const key = { studentId, subject, term: term || '' }
      let existing = await Mark.findOne(key)
      if (existing) {
        existing.obtained = Number(obtained)
        if (total !== undefined) existing.total = Number(total)
        existing.class = String(cls || existing.class)
        existing.section = section || existing.section
        existing.createdBy = req.user.sub
        await existing.save()
        results.push(existing)
      } else {
        const created = await Mark.create({ class: String(cls || ''), section: section || '', studentId, subject, total: Number(total || 0), obtained: Number(obtained), term: term || '', createdBy: req.user.sub })
        results.push(created)
      }
    }
    return res.json(results)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.put('/api/marks/:id', verifyToken, requireRole('faculty'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const upd = await Mark.findById(req.params.id)
    if (!upd) return res.status(404).json({ message: 'Not found' })
    const { obtained, total, subject, term } = req.body || {}
    if (obtained !== undefined) upd.obtained = Number(obtained)
    if (total !== undefined) upd.total = Number(total)
    if (subject !== undefined) upd.subject = subject
    if (term !== undefined) upd.term = term
    await upd.save()
    return res.json(upd)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.get('/api/marks', verifyToken, requireRole(['admin','faculty','parent','student']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { class: cls, section, studentId } = req.query || {}
    const q = {}
    if (cls) q.class = String(cls)
    if (section) q.section = String(section)
    if (studentId) q.studentId = studentId
    const items = await Mark.find(q).sort({ createdAt: -1 }).lean()
    return res.json(items)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Return marks for the logged-in student (or parent with studentId query)
app.get('/api/marks/my', verifyToken, requireRole(['student','parent','faculty','admin']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const role = req.user && req.user.role
    if (role === 'student') {
      // find student by email = username
      const s = await Student.findOne({ email: req.user.username }).lean()
      if (!s) return res.status(404).json({ message: 'Student record not found' })
      const items = await Mark.find({ studentId: s._id }).sort({ createdAt: -1 }).lean()
      return res.json(items)
    }
    // parent: require studentId query param
    if (role === 'parent') {
      const { studentId } = req.query || {}
      if (!studentId) return res.status(400).json({ message: 'studentId required for parent' })
      const items = await Mark.find({ studentId }).sort({ createdAt: -1 }).lean()
      return res.json(items)
    }
    // faculty/admin: support optional studentId query
    const { studentId } = req.query || {}
    const q = {}
    if (studentId) q.studentId = studentId
    const items = await Mark.find(q).sort({ createdAt: -1 }).lean()
    return res.json(items)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Faculty: lesson planning management
app.get('/api/faculty/lesson-plans', verifyToken, requireRole(['faculty','admin']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const LessonPlan = require('./models/LessonPlan')
    const { class: cls, section, subject, status, from, to } = req.query || {}
    const q = {}
    if (req.user && req.user.role === 'faculty') q.facultyUserId = req.user.sub
    if (cls) q.class = String(cls)
    if (section) q.section = String(section)
    if (subject) q.subject = new RegExp(String(subject), 'i')
    if (status) q.status = String(status)
    if (from || to) {
      q.lessonDate = {}
      if (from) q.lessonDate.$gte = String(from)
      if (to) q.lessonDate.$lte = String(to)
    }
    const items = await LessonPlan.find(q).sort({ lessonDate: -1, createdAt: -1 }).lean()
    return res.json(items)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.post('/api/faculty/lesson-plans', verifyToken, requireRole('faculty'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const LessonPlan = require('./models/LessonPlan')
    const { class: cls, section = 'ALL', subject, title, lessonDate, durationMinutes = 40, objectives = '', materials = '', activities = '', homework = '', assessment = '', status = 'planned', notes = '' } = req.body || {}
    if (!cls || !subject || !title || !lessonDate) return res.status(400).json({ message: 'class, subject, title and lessonDate required' })
    const user = await User.findById(req.user.sub).lean().catch(() => null)
    const faculty = await Faculty.findOne({ email: req.user.username }).lean().catch(() => null)
    const doc = await LessonPlan.create({
      facultyUserId: req.user.sub,
      facultyId: faculty && faculty._id,
      teacherName: (faculty && faculty.name) || (user && user.name) || req.user.username || '',
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
    })
    return res.status(201).json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.put('/api/faculty/lesson-plans/:id', verifyToken, requireRole('faculty'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const LessonPlan = require('./models/LessonPlan')
    const doc = await LessonPlan.findOne({ _id: req.params.id, facultyUserId: req.user.sub })
    if (!doc) return res.status(404).json({ message: 'Lesson plan not found' })
    const allowed = ['class', 'section', 'subject', 'title', 'lessonDate', 'durationMinutes', 'objectives', 'materials', 'activities', 'homework', 'assessment', 'status', 'notes']
    allowed.forEach(key => {
      if (req.body && req.body[key] !== undefined) doc[key] = key === 'durationMinutes' ? Number(req.body[key] || 40) : String(req.body[key] || '')
    })
    if (!['planned', 'in_progress', 'completed'].includes(String(doc.status))) doc.status = 'planned'
    await doc.save()
    return res.json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.delete('/api/faculty/lesson-plans/:id', verifyToken, requireRole('faculty'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const LessonPlan = require('./models/LessonPlan')
    const doc = await LessonPlan.findOneAndDelete({ _id: req.params.id, facultyUserId: req.user.sub }).lean()
    if (!doc) return res.status(404).json({ message: 'Lesson plan not found' })
    return res.json({ ok: true })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

function mapBehaviorRecord(record) {
  if (!record) return record
  return {
    ...record,
    typeLabel: record.type === 'incident' ? 'Incident' : record.type === 'counseling' ? 'Counseling Log' : 'Remark'
  }
}

async function ensureParentLinked(parentUserId, studentId) {
  const parent = await User.findById(parentUserId).lean().catch(() => null)
  return !!(parent && parent.role === 'parent' && Array.isArray(parent.parentOf) && parent.parentOf.some(x => String(x) === String(studentId)))
}

// Behavior records: incidents, remarks, and counseling logs
app.get('/api/behavior-records/my', verifyToken, requireRole('student'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const BehaviorRecord = require('./models/BehaviorRecord')
    const student = await Student.findOne({ email: req.user.username }).lean().catch(() => null)
    if (!student) return res.status(404).json({ message: 'Student record not found' })
    const items = await BehaviorRecord.find({ studentId: student._id }).sort({ recordDate: -1, createdAt: -1 }).lean()
    return res.json(items.map(mapBehaviorRecord))
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.get('/api/behavior-records/by-student/:id', verifyToken, requireRole(['parent','admin','faculty']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const BehaviorRecord = require('./models/BehaviorRecord')
    const studentId = req.params.id
    if (req.user.role === 'parent') {
      const linked = await ensureParentLinked(req.user.sub, studentId)
      if (!linked) return res.status(403).json({ message: 'Parent is not linked to this student' })
    }
    const items = await BehaviorRecord.find({ studentId }).sort({ recordDate: -1, createdAt: -1 }).lean()
    return res.json(items.map(mapBehaviorRecord))
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.post('/api/behavior-records', verifyToken, requireRole(['admin','faculty']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const BehaviorRecord = require('./models/BehaviorRecord')
    const { studentId, type, title, description = '', actionTaken = '', followUpDate = '', severity = 'low', status = 'open', recordDate } = req.body || {}
    if (!studentId || !type || !title) return res.status(400).json({ message: 'studentId, type and title required' })
    const student = await Student.findById(studentId).lean().catch(() => null)
    if (!student) return res.status(404).json({ message: 'Student not found' })
    const user = await User.findById(req.user.sub).lean().catch(() => null)
    const doc = await BehaviorRecord.create({
      studentId,
      studentName: student.name || '',
      class: student.class || '',
      section: student.section || '',
      rollNo: student.rollNo || '',
      type,
      title: String(title),
      description: String(description || ''),
      actionTaken: String(actionTaken || ''),
      followUpDate: followUpDate ? String(followUpDate) : '',
      severity: ['low','medium','high'].includes(String(severity)) ? String(severity) : 'low',
      status: ['open','monitoring','resolved'].includes(String(status)) ? String(status) : 'open',
      recordDate: recordDate ? String(recordDate) : new Date().toISOString().slice(0, 10),
      recordedBy: req.user.sub,
      recordedByName: (user && user.name) || req.user.username || ''
    })
    return res.status(201).json(mapBehaviorRecord(doc.toObject()))
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

function escapeExcelCell(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function safeSheetName(name) {
  return String(name || 'Report').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Report'
}

function buildExcelCell(value, styleId) {
  return `<Cell${styleId ? ` ss:StyleID="${styleId}"` : ''}><Data ss:Type="String">${escapeExcelCell(value)}</Data></Cell>`
}

function buildWorksheet(sheetName, title, rows) {
  const normalizedRows = rows && rows.length > 1 ? rows : [
    ...((rows && rows.length) ? rows : [['Report']]),
    ['No records found for the selected filters.']
  ]
  const safeTitle = escapeExcelCell(title || 'Report')
  const colCount = Math.max(...(normalizedRows || [[]]).map(row => row.length || 1), 1)
  const generatedAt = new Date().toLocaleString('en-IN')
  const columns = Array.from({ length: colCount }, (_, index) => {
    const header = String((normalizedRows[0] || [])[index] || '').toLowerCase()
    let width = 95
    if (header.includes('student name') || header.includes('email')) width = 170
    if (header.includes('student id') || header.includes('receipt')) width = 150
    if (header.includes('amount') || header.includes('percentage')) width = 110
    return `<Column ss:AutoFitWidth="0" ss:Width="${width}"/>`
  }).join('')
  const bodyRows = normalizedRows.map((row, index) => {
    const isHeader = index === 0
    const isEmpty = row.length === 1 && String(row[0] || '').startsWith('No records found')
    if (isEmpty) {
      return `<Row ss:Height="24"><Cell ss:MergeAcross="${Math.max(colCount - 1, 0)}" ss:StyleID="Empty"><Data ss:Type="String">${escapeExcelCell(row[0])}</Data></Cell></Row>`
    }
    const cells = Array.from({ length: colCount }, (_, cellIndex) => buildExcelCell(row[cellIndex] || '', isHeader ? 'Header' : 'Body')).join('')
    return `<Row>${cells}</Row>`
  }).join('')
  return `<Worksheet ss:Name="${escapeExcelCell(safeSheetName(sheetName))}">
  <Table>
    ${columns}
    <Row ss:Height="28"><Cell ss:MergeAcross="${Math.max(colCount - 1, 0)}" ss:StyleID="Title"><Data ss:Type="String">${safeTitle}</Data></Cell></Row>
    <Row><Cell ss:MergeAcross="${Math.max(colCount - 1, 0)}" ss:StyleID="Meta"><Data ss:Type="String">Generated on ${escapeExcelCell(generatedAt)}</Data></Cell></Row>
    <Row/>
    ${bodyRows}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
    <FreezePanes/>
    <FrozenNoSplit/>
    <SplitHorizontal>4</SplitHorizontal>
    <TopRowBottomPane>4</TopRowBottomPane>
    <ActivePane>2</ActivePane>
  </WorksheetOptions>
</Worksheet>`
}

function buildExcelWorkbook(title, sheets) {
  const workbookSheets = Array.isArray(sheets) && sheets.length ? sheets : [{ name: title, title, rows: [['Report'], ['No records found for the selected filters.']] }]
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Title">
      <Font ss:Bold="1" ss:Size="16" ss:Color="#0F172A"/>
      <Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#93C5FD"/></Borders>
    </Style>
    <Style ss:ID="Meta">
      <Font ss:Color="#475569"/>
      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Header">
      <Font ss:Bold="1" ss:Color="#0F172A"/>
      <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
      </Borders>
    </Style>
    <Style ss:ID="Body">
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>
    <Style ss:ID="Empty">
      <Font ss:Italic="1" ss:Color="#64748B"/>
      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  ${workbookSheets.map(sheet => buildWorksheet(sheet.name, sheet.title || sheet.name, sheet.rows)).join('\n')}
</Workbook>`
}

function sendExcel(res, title, rows, filename) {
  const body = buildExcelWorkbook(title, [{ name: title, title, rows }])
  res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  return res.status(200).send(body)
}

function sendExcelSheets(res, sheets, filename) {
  const body = buildExcelWorkbook(filename.replace(/\.xls$/i, ''), sheets)
  res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  return res.status(200).send(body)
}

function reportDateFilter(from, to) {
  if (!from && !to) return null
  const filter = {}
  if (from) filter.$gte = String(from)
  if (to) filter.$lte = String(to)
  return filter
}

function reportCreatedAtFilter(from, to) {
  if (!from && !to) return null
  const filter = {}
  if (from) {
    const start = new Date(String(from))
    start.setHours(0, 0, 0, 0)
    filter.$gte = start
  }
  if (to) {
    const end = new Date(String(to))
    end.setHours(23, 59, 59, 999)
    filter.$lte = end
  }
  return filter
}

function addEmptyReportRow(rows) {
  if (rows.length === 1) {
    rows.push(['No records found for the selected filters.'])
  }
  return rows
}

function termVariants(term) {
  const raw = String(term || '').trim()
  if (!raw) return []
  const compact = raw.replace(/\s+/g, '')
  const spaced = compact.replace(/^Term(\d)$/i, 'Term $1')
  return Array.from(new Set([raw, compact, spaced]))
}

async function buildAttendanceReportRows(query) {
  const { class: cls, section, studentId, from, to } = query || {}
  const q = {}
  if (cls) q.class = String(cls)
  if (section) q.section = String(section)
  const dateFilter = reportDateFilter(from, to)
  if (dateFilter) q.date = dateFilter
  const items = await Attendance.find(q).sort({ date: 1 }).lean()
  const ids = new Set()
  ;(items || []).forEach(item => {
    ;(item.records || []).forEach(record => {
      if (!studentId || String(record.studentId) === String(studentId)) ids.add(String(record.studentId))
    })
  })
  const students = ids.size ? await Student.find({ _id: { $in: Array.from(ids) } }).lean() : []
  const byId = {}
  ;(students || []).forEach(student => { byId[String(student._id)] = student })
  const rows = [['Date', 'Class', 'Section', 'Student ID', 'Student Name', 'Roll No', 'Status']]
  ;(items || []).forEach(item => {
    ;(item.records || []).forEach(record => {
      if (studentId && String(record.studentId) !== String(studentId)) return
      const student = byId[String(record.studentId)] || {}
      rows.push([
        item.date || '',
        item.class || '',
        item.section || '',
        record.studentId || '',
        student.name || '',
        student.rollNo || '',
        record.status || ''
      ])
    })
  })
  return addEmptyReportRow(rows)
}

async function buildFeesReportRows(query) {
  const { class: cls, section, studentId, from, to, term, paymentStatus } = query || {}
  const studentsQuery = {}
  if (cls) studentsQuery.class = String(cls)
  if (section) studentsQuery.section = String(section)
  if (studentId) studentsQuery._id = studentId
  const students = await Student.find(studentsQuery).sort({ class: 1, section: 1, rollNo: 1, name: 1 }).lean()
  const studentIds = students.map(s => String(s._id))
  const receiptQuery = {}
  if (studentIds.length) receiptQuery.studentId = { $in: studentIds }
  if (term) receiptQuery.term = { $in: termVariants(term) }
  const createdAtFilter = reportCreatedAtFilter(from, to)
  if (createdAtFilter) receiptQuery.createdAt = createdAtFilter
  const receipts = await Receipt.find(receiptQuery).sort({ createdAt: -1 }).lean()
  const paidKeys = new Set()
  ;(receipts || []).forEach(r => paidKeys.add(`${String(r.studentId || '')}|${String(r.term || '')}`))
  const receiptByKey = {}
  ;(receipts || []).forEach(r => {
    const key = `${String(r.studentId || '')}|${String(r.term || '')}`
    if (!receiptByKey[key]) receiptByKey[key] = []
    receiptByKey[key].push(r)
  })
  const rows = [['Student ID', 'Student Name', 'Email', 'Class', 'Section', 'Roll No', 'Term', 'Assigned Amount', 'Paid Amount', 'Status', 'Paid On', 'Receipt ID']]
  ;(students || []).forEach(student => {
    const allowedTerms = termVariants(term)
    const assignedFees = (student.assignedFees || []).filter(fee => !term || allowedTerms.includes(String(fee.term || '')))
    const feeRows = assignedFees.length ? assignedFees : [{ term: term || '', amount: '' }]
    feeRows.forEach(fee => {
      const key = `${String(student._id)}|${String(fee.term || '')}`
      const recs = receiptByKey[key] || []
      const paidAmount = recs.reduce((sum, r) => sum + Number(r.amount || 0), 0)
      const status = paidKeys.has(key) || paidAmount > 0 ? 'Paid' : 'Pending'
      if (paymentStatus === 'paid' && status !== 'Paid') return
      if (paymentStatus === 'pending' && status !== 'Pending') return
      rows.push([
        student._id || '',
        student.name || '',
        student.email || '',
        student.class || '',
        student.section || '',
        student.rollNo || '',
        fee.term || '',
        fee.amount || '',
        paidAmount || '',
        status,
        recs[0] && recs[0].createdAt ? new Date(recs[0].createdAt).toLocaleDateString('en-IN') : '',
        recs[0] && recs[0]._id ? recs[0]._id : ''
      ])
    })
  })
  return addEmptyReportRow(rows)
}

async function buildMarksReportRows(query) {
  const { class: cls, section, studentId, subject, term, from, to } = query || {}
  const q = {}
  if (cls) q.class = String(cls)
  if (section) q.section = String(section)
  if (studentId) q.studentId = studentId
  if (subject) q.subject = new RegExp(String(subject), 'i')
  if (term) q.term = { $in: termVariants(term) }
  const createdAtFilter = reportCreatedAtFilter(from, to)
  if (createdAtFilter) q.createdAt = createdAtFilter
  const marks = await Mark.find(q).sort({ class: 1, section: 1, subject: 1, createdAt: -1 }).lean()
  const ids = Array.from(new Set((marks || []).map(m => String(m.studentId)).filter(Boolean)))
  const students = ids.length ? await Student.find({ _id: { $in: ids } }).lean() : []
  const byId = {}
  ;(students || []).forEach(student => { byId[String(student._id)] = student })
  const rows = [['Class', 'Section', 'Student ID', 'Student Name', 'Roll No', 'Subject', 'Term', 'Obtained', 'Total', 'Percentage', 'Recorded On']]
  ;(marks || []).forEach(mark => {
    const student = byId[String(mark.studentId)] || {}
    const total = Number(mark.total || 0)
    const obtained = Number(mark.obtained || 0)
    rows.push([
      mark.class || '',
      mark.section || '',
      mark.studentId || '',
      student.name || '',
      student.rollNo || '',
      mark.subject || '',
      mark.term || '',
      obtained,
      total,
      total ? `${Math.round((obtained / total) * 10000) / 100}%` : '',
      mark.createdAt ? new Date(mark.createdAt).toLocaleDateString('en-IN') : ''
    ])
  })
  return addEmptyReportRow(rows)
}

app.get('/api/reports/excel', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const type = String((req.query && req.query.type) || 'attendance')
    const reportBuilders = {
      attendance: { title: 'Attendance Report', file: 'attendance_report.xls', build: buildAttendanceReportRows },
      fees: { title: 'Fees Report', file: 'fees_report.xls', build: buildFeesReportRows },
      marks: { title: 'Marks Report', file: 'marks_report.xls', build: buildMarksReportRows }
    }
    if (type === 'custom') {
      const attendanceRows = await buildAttendanceReportRows(req.query)
      const feesRows = await buildFeesReportRows(req.query)
      const marksRows = await buildMarksReportRows(req.query)
      return sendExcelSheets(res, [
        { name: 'Attendance', title: 'Attendance Report', rows: attendanceRows },
        { name: 'Fees', title: 'Fees Report', rows: feesRows },
        { name: 'Marks', title: 'Marks Report', rows: marksRows }
      ], 'combined_school_report.xls')
    }
    const selected = reportBuilders[type]
    if (!selected) return res.status(400).json({ message: 'Invalid report type' })
    const rows = await selected.build(req.query)
    return sendExcel(res, selected.title, rows, selected.file)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: approve student registration
app.put('/api/students/registrations/:id/approve', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const reg = await StudentRegistration.findById(req.params.id)
    if (!reg) return res.status(404).json({ message: 'Registration not found' })

    // Block if email is already used by any account (admin/faculty/student/staff)
    const existingAccount = await User.findOne({ username: reg.email }).lean().catch(() => null)
    if (existingAccount) return res.status(409).json({ message: 'This email is already in use for another account' })

    // assign section A-D with capacity 50
    const sections = ['A','B','C','D']
    let assignedSection = null
    for (const s of sections) {
      const count = await Student.countDocuments({ class: reg.class, section: s })
      if (count < 50) { assignedSection = s; break }
    }
    if (!assignedSection) return res.status(400).json({ message: 'Class is full' })

    // roll number: class + section + next number
    const existing = await Student.countDocuments({ class: reg.class, section: assignedSection })
    const rollNo = `${reg.class}${assignedSection}${existing + 1}`

    const studentDoc = await Student.create({ name: reg.name, email: reg.email, class: reg.class, section: assignedSection, rollNo, avatar: reg.avatar, medium: reg.medium || 'English' })

    // create user
    let user = null
    let generatedPassword = null
    generatedPassword = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 90 + 10)
    const hashed = await bcrypt.hash(generatedPassword, 10)
    user = await User.create({ username: reg.email, password: hashed, role: 'student', name: reg.name })

    reg.status = 'approved'
    await reg.save()

    // send congratulation email with credentials
    try {
      const loginUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || ''
      const subject = 'Congratulations — your student registration has been approved'
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
      `
      await sendMail({ to: reg.email, subject, html })
    } catch (mailErr) { console.warn('Failed to send student approval email:', mailErr && (mailErr.message || String(mailErr))) }

    // SSE
    try { sendSseEvent('student_approved', { id: reg._id, name: reg.name, email: reg.email, class: reg.class, section: assignedSection }) } catch (e) {}

    return res.json({ registration: reg.toObject(), student: studentDoc.toObject(), user: user ? { id: user._id, username: user.username } : null })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: reject student registration
app.put('/api/students/registrations/:id/reject', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { note } = req.body || {}
    const reg = await StudentRegistration.findById(req.params.id)
    if (!reg) return res.status(404).json({ message: 'Registration not found' })
    reg.status = 'rejected'
    reg.note = note || ''
    await reg.save()

    // notify student by email
    try {
      const subject = 'Your student registration has been rejected'
      const html = `
        <div style="font-family:Arial,sans-serif;padding:20px;background:#f7f7fb">
          <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
            <div style="background:linear-gradient(90deg,#ef4444,#fb923c);padding:18px;color:white"><h2 style="margin:0">Registration Update</h2></div>
            <div style="padding:18px"><p>Dear ${reg.name || 'Applicant'},</p><p>Your student registration has been reviewed and <strong>rejected</strong>.</p><p>Note from admin: ${reg.note || 'No note provided.'}</p><p>If you have questions, contact the administration.</p></div>
          </div>
        </div>
      `
      await sendMail({ to: reg.email, subject, html })
    } catch (mailErr) { console.warn('Failed to send student rejection email:', mailErr && (mailErr.message || String(mailErr))) }

    try { sendSseEvent('student_rejected', { id: reg._id, name: reg.name, email: reg.email }) } catch (e) {}

    return res.json(reg)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: list pending/processed faculty registrations
app.get('/api/faculty/registrations', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { status } = req.query || {}
    const q = {}
    if (status) q.status = status
    const items = await FacultyRegistration.find(q).sort({ createdAt: -1 }).lean()
    return res.json(items)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Admin: approve registration -> create Faculty record and mark registration approved
app.put('/api/faculty/registrations/:id/approve', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const reg = await FacultyRegistration.findById(req.params.id)
    if (!reg) return res.status(404).json({ message: 'Registration not found' })

    // Block reuse of email across roles
    const existingAccount = await User.findOne({ username: reg.email }).lean().catch(() => null)
    if (existingAccount) return res.status(409).json({ message: 'This email is already in use for another account' })

    // create Faculty record if not exists and ensure unique employeeId
    let facultyDoc = await Faculty.findOne({ email: reg.email })
    if (!facultyDoc) {
      // generate unique employeeId (EMP + timestamp + random)
      function genId() { return `EMP${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}` }
      let empId = genId()
      // ensure uniqueness
      let attempts = 0
      while (await Faculty.findOne({ employeeId: empId })) {
        empId = genId()
        attempts++
        if (attempts > 5) break
      }
      facultyDoc = await Faculty.create({ name: reg.name, email: reg.email, employeeId: empId, subject: reg.subject, experience: reg.experience, contact: reg.contact, avatar: reg.avatar, classGrade: reg.classGrade, houses: Array.isArray(reg.houses) ? reg.houses : [] })
    }

    // create a login user for the faculty
    let user = null
    let generatedPassword = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 90 + 10)
    const hashed = await bcrypt.hash(generatedPassword, 10)
    user = await User.create({ username: reg.email, password: hashed, role: 'faculty', name: reg.name })

    // mark registration approved
    reg.status = 'approved'
    await reg.save()

    // notify admin UIs via SSE
    try { sendSseEvent('faculty_approved', { id: reg._id, name: reg.name, email: reg.email, employeeId: facultyDoc.employeeId }) } catch (e) {}

    // try to send a congratulation email with credentials (if SMTP configured)
    let mailStatus = { attempted: false, sent: false, info: null, error: null }
    try {
      const loginUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || ''
      const subject = 'Congratulations — you have been selected as a Teacher'
      const passwordRow = generatedPassword ? `
            <tr>
              <td style="padding:8px 12px;background:#fafafa;font-weight:600;border-top:1px solid #eee">Password</td>
              <td style="padding:8px 12px;background:#fafafa;border-top:1px solid #eee"><strong>${generatedPassword}</strong></td>
            </tr>` : ''

      const html = `
        <div style="font-family: Inter, Arial, sans-serif; background:#f3f4f6; padding:24px;">
          <div style="max-width:680px;margin:0 auto;">
            <div style="background:linear-gradient(90deg,#6a4ef6,#9f7efe);padding:20px;border-radius:10px 10px 0 0;color:#fff;text-align:left;">
              <h1 style="margin:0;font-size:22px;">Congratulations ${reg.name}!</h1>
              <div style="margin-top:6px;opacity:0.95">You have been selected for the role of <strong>Teacher</strong>.</div>
            </div>
            <div style="background:#ffffff;padding:18px;border:1px solid #e8e8f0;border-top:0;border-radius:0 0 10px 10px;">
              <p style="margin:0 0 12px;color:#374151">An account has been created for you on our ERP system. Below are your account details — keep them secure.</p>

              <table style="width:100%;border-collapse:collapse;margin-top:8px;border-radius:6px;overflow:hidden;box-shadow:0 6px 18px rgba(99,102,241,0.08)">
                <tr>
                  <td style="padding:12px 12px 12px 16px;background:#f9fafb;font-weight:700;color:#111;border-bottom:1px solid #f1f1f5;width:40%">Username</td>
                  <td style="padding:12px 16px;background:#fff;border-bottom:1px solid #f1f1f5">${reg.email}</td>
                </tr>
                ${passwordRow}
                <tr>
                  <td style="padding:12px 12px 12px 16px;background:#f9fafb;font-weight:700;color:#111;border-top:${generatedPassword ? '0' : '1px solid #f1f1f5'}">Employee ID</td>
                  <td style="padding:12px 16px;background:#fff">${facultyDoc.employeeId}</td>
                </tr>
                <tr>
                  <td style="padding:12px 12px 12px 16px;background:#f9fafb;font-weight:700;color:#111;border-top:1px solid #f1f1f5">Class</td>
                  <td style="padding:12px 16px;background:#fff">${facultyDoc.classGrade || reg.classGrade || '-'}</td>
                </tr>
              </table>

              <div style="margin-top:16px;text-align:left">
                <a href="${loginUrl}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:linear-gradient(90deg,#7c3aed,#06b6d4);color:white;text-decoration:none;font-weight:600">Login to ERP</a>
              </div>

              <p style="margin-top:14px;color:#6b7280;font-size:13px">${generatedPassword ? 'Please change your password after first login.' : 'Use your existing credentials to login.'}</p>
              <p style="margin-top:10px;color:#9ca3af;font-size:12px">If you did not expect this email or there is an issue, please contact the administrator.</p>
              <div style="margin-top:18px;color:#6b7280;font-size:13px">Regards,<br/>Admin</div>
            </div>
          </div>
        </div>
      `

      // Use shared sendMail helper.
      mailStatus = await sendMail({ to: reg.email, subject, html })
      if (mailStatus.sent) console.log('Approval email sent to', reg.email)
    } catch (mailErr) {
      mailStatus.error = mailErr && (mailErr.message || String(mailErr))
      console.warn('Failed to send approval email:', mailStatus.error)
    }

    return res.json({ registration: reg.toObject(), faculty: facultyDoc, user: user ? { id: user._id, username: user.username } : null, mail: mailStatus })
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Admin: list admins
app.get('/api/admins', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const q = (req.query.q || '').trim()
    const base = { role: 'admin' }
    let filter = base
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter = { $and: [base, { $or: [ { name: re }, { username: re }, { designation: re }, { contact: re } ] } ] }
    }
    const admins = await User.find(filter).select('name fatherName username disabled contact address designation createdAt').sort({ createdAt: -1 }).lean()
    return res.json(admins)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: create admin (admin-only)
app.post('/api/admins', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { name, fatherName, email, contact, address, designation } = req.body || {}
    if (!name || !email) return res.status(400).json({ message: 'name and email required' })

    let existing = await User.findOne({ username: email }).lean().catch(() => null)
    if (existing) return res.status(409).json({ message: 'User already exists' })

    const generatedPassword = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 90 + 10)
    const hashed = await bcrypt.hash(generatedPassword, 10)
    const created = await User.create({ username: email, password: hashed, role: 'admin', name, fatherName, contact, address, designation })

    // send email with credentials
    try {
      const loginUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || ''
      const subject = 'You have been selected as Staff'
      const html = `
        <div style="font-family:Inter,Arial,sans-serif;background:#f3f4f6;padding:20px">
          <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
            <div style="background:linear-gradient(90deg,#06b6d4,#0ea5a4);padding:18px;color:#fff"><h2 style="margin:0">Welcome ${name}!</h2></div>
            <div style="padding:16px;color:#333">
              <p>You have been added as <strong>Staff</strong> on the ERP system with administrative access. Below are your login details — keep them secure.</p>
              <table style="width:100%;border-collapse:collapse;margin-top:8px">
                <tr><td style="font-weight:700;padding:6px 0">Username</td><td style="padding:6px 0">${email}</td></tr>
                <tr><td style="font-weight:700;padding:6px 0">Password</td><td style="padding:6px 0"><strong>${generatedPassword}</strong></td></tr>
                ${fatherName ? `<tr><td style="font-weight:700;padding:6px 0">Father Name</td><td style="padding:6px 0">${fatherName}</td></tr>` : ''}
                <tr><td style="font-weight:700;padding:6px 0">Designation</td><td style="padding:6px 0">${designation || '-'}</td></tr>
                <tr><td style="font-weight:700;padding:6px 0">Contact</td><td style="padding:6px 0">${contact || '-'}</td></tr>
              </table>
              <p style="margin-top:12px"><a href="${loginUrl}" style="display:inline-block;padding:10px 14px;background:linear-gradient(90deg,#7c3aed,#06b6d4);color:#fff;border-radius:8px;text-decoration:none">Login to ERP</a></p>
            </div>
          </div>
        </div>
      `
      await sendMail({ to: email, subject, html })
    } catch (mailErr) { console.warn('Failed to send admin creation email:', mailErr && (mailErr.message || String(mailErr))) }

    return res.status(201).json({ id: created._id, username: created.username })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: delete admin user
app.delete('/api/admins/:id', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const id = req.params.id
    if (!id) return res.status(400).json({ message: 'id required' })
    const user = await User.findById(id)
    if (!user) return res.status(404).json({ message: 'Admin not found' })
    if (user.role !== 'admin') return res.status(400).json({ message: 'Not an admin account' })
    await User.deleteOne({ _id: id })
    return res.json({ ok: true })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: block/unblock admin
app.put('/api/admins/:id/block', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const id = req.params.id
    const { block } = req.body || {}
    if (!id) return res.status(400).json({ message: 'id required' })
    const user = await User.findById(id)
    if (!user) return res.status(404).json({ message: 'Admin not found' })
    if (user.role !== 'admin') return res.status(400).json({ message: 'Not an admin account' })
    // Prevent blocking the currently authenticated admin (main admin)
    if (String(req.user.sub) === String(id)) return res.status(400).json({ message: 'Cannot block the main admin' })
    user.disabled = !!block
    await user.save()
    return res.json({ ok: true })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: update admin details (contact, designation)
app.put('/api/admins/:id', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const id = req.params.id
    const { contact, designation, name, fatherName, address, gender, age, religion, category } = req.body || {}
    if (!id) return res.status(400).json({ message: 'id required' })
    const user = await User.findById(id)
    if (!user) return res.status(404).json({ message: 'Admin not found' })
    if (user.role !== 'admin') return res.status(400).json({ message: 'Not an admin account' })

    // For safety, only allow updating these fields
    if (contact !== undefined) user.contact = contact
    if (designation !== undefined) user.designation = designation
    if (name !== undefined) user.name = name
    if (fatherName !== undefined) user.fatherName = fatherName
    if (address !== undefined) user.address = address

    await user.save()
    return res.json({ ok: true, admin: { id: user._id, name: user.name, fatherName: user.fatherName, username: user.username, contact: user.contact, designation: user.designation, address: user.address } })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Staff: list staff (non-admin employees)
app.get('/api/staff', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const q = (req.query.q || '').trim()
    const base = { role: 'staff' }
    let filter = base
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter = { $and: [base, { $or: [ { name: re }, { username: re }, { designation: re }, { contact: re }, { fatherName: re } ] } ] }
    }
    const staff = await User.find(filter).select('name fatherName username disabled contact address designation createdAt').sort({ createdAt: -1 }).lean()
    return res.json(staff)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Staff: create staff (non-admin)
app.post('/api/staff', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { name, fatherName, email, contact, address, designation, password, gender, age, religion, category } = req.body || {}
    if (!name || !email) return res.status(400).json({ message: 'name and email required' })

    let existing = await User.findOne({ username: email }).lean().catch(() => null)
    if (existing) return res.status(409).json({ message: 'User already exists' })

    const plainPassword = password && String(password).length >= 6 ? String(password) : (Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 90 + 10))
    const hashed = await bcrypt.hash(plainPassword, 10)
    const created = await User.create({ username: email, password: hashed, role: 'staff', name, fatherName, contact, address, designation })

    // send email with credentials
    try {
      const loginUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'http://localhost:5173/staff-login'
      const subject = 'You have been selected as Staff'
      const html = `
        <div style="font-family:Inter,Arial,sans-serif;background:#f3f4f6;padding:20px">
          <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
            <div style="background:linear-gradient(90deg,#06b6d4,#0ea5a4);padding:18px;color:#fff"><h2 style="margin:0">Welcome ${name}!</h2></div>
            <div style="padding:16px;color:#333">
              <p>You have been added as <strong>Staff</strong> on the ERP system. Below are your login details — keep them secure.</p>
              <table style="width:100%;border-collapse:collapse;margin-top:8px">
                <tr><td style="font-weight:700;padding:6px 0">Username</td><td style="padding:6px 0">${email}</td></tr>
                <tr><td style="font-weight:700;padding:6px 0">Password</td><td style="padding:6px 0"><strong>${plainPassword}</strong></td></tr>
                ${fatherName ? `<tr><td style="font-weight:700;padding:6px 0">Father Name</td><td style="padding:6px 0">${fatherName}</td></tr>` : ''}
                <tr><td style="font-weight:700;padding:6px 0">Designation</td><td style="padding:6px 0">${designation || '-'}</td></tr>
                <tr><td style="font-weight:700;padding:6px 0">Contact</td><td style="padding:6px 0">${contact || '-'}</td></tr>
              </table>
              <p style="margin-top:12px"><a href="${loginUrl}" style="display:inline-block;padding:10px 14px;background:linear-gradient(90deg,#7c3aed,#06b6d4);color:#fff;border-radius:8px;text-decoration:none">Login to ERP</a></p>
            </div>
          </div>
        </div>
      `
      await sendMail({ to: email, subject, html })
    } catch (mailErr) { console.warn('Failed to send staff creation email:', mailErr && (mailErr.message || String(mailErr))) }

    return res.status(201).json({ id: created._id, username: created.username, password: plainPassword })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Staff: delete staff user
app.delete('/api/staff/:id', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const id = req.params.id
    if (!id) return res.status(400).json({ message: 'id required' })
    const user = await User.findById(id)
    if (!user) return res.status(404).json({ message: 'Staff not found' })
    if (user.role !== 'staff') return res.status(400).json({ message: 'Not a staff account' })
    await User.deleteOne({ _id: id })
    return res.json({ ok: true })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Staff: block/unblock staff
app.put('/api/staff/:id/block', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const id = req.params.id
    const { block } = req.body || {}
    if (!id) return res.status(400).json({ message: 'id required' })
    const user = await User.findById(id)
    if (!user) return res.status(404).json({ message: 'Staff not found' })
    if (user.role !== 'staff') return res.status(400).json({ message: 'Not a staff account' })
    user.disabled = !!block
    await user.save()
    return res.json({ ok: true })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Staff: update staff details
app.put('/api/staff/:id', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const id = req.params.id
    const { contact, designation, name, fatherName, address, gender, age, religion, category } = req.body || {}
    if (!id) return res.status(400).json({ message: 'id required' })
    const user = await User.findById(id)
    if (!user) return res.status(404).json({ message: 'Staff not found' })
    if (user.role !== 'staff') return res.status(400).json({ message: 'Not a staff account' })
    if (contact !== undefined) user.contact = contact
    if (designation !== undefined) user.designation = designation
    if (name !== undefined) user.name = name
    if (fatherName !== undefined) user.fatherName = fatherName
    if (address !== undefined) user.address = address
    await user.save()
    return res.json({ ok: true, staff: { id: user._id, name: user.name, fatherName: user.fatherName, username: user.username, contact: user.contact, designation: user.designation, address: user.address } })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// HR management (admin) - expose endpoints for frontend `/api/hr` calls
app.get('/api/hr', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const q = (req.query.q || '').trim()
    const base = { role: 'staff', hr: true }
    let filter = base
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter = { $and: [base, { $or: [ { name: re }, { username: re }, { designation: re }, { contact: re }, { fatherName: re } ] } ] }
    }
    const list = await User.find(filter).select('name fatherName username disabled contact address designation gender age religion category createdAt').sort({ createdAt: -1 }).lean()
    return res.json(list)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.post('/api/hr', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { name, fatherName, email, contact, address, designation, password, gender, age, religion, category } = req.body || {}
    if (!name || !email) return res.status(400).json({ message: 'name and email required' })

    let existing = await User.findOne({ username: email }).lean().catch(() => null)
    if (existing) return res.status(409).json({ message: 'User already exists' })

    const plainPassword = password && String(password).length >= 6 ? String(password) : (Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 90 + 10))
    const hashed = await bcrypt.hash(plainPassword, 10)
    const doc = await User.create({ username: email, password: hashed, role: 'staff', hr: true, name, fatherName, contact, address, designation, gender: gender || '', age: (age !== undefined && age !== '' && age !== null) ? Number(age) : null, religion: religion || '', category: category || '' })

    // Send welcome email with credentials (best-effort)
    try {
      const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || ''
      const loginLink = frontendUrl ? `${frontendUrl}/staff-login` : `${process.env.FRONTEND_DIST ? process.env.FRONTEND_DIST : ''}`
      const subject = 'Welcome — You have been added as HR'
      const html = `<p>Hello ${String(name || '')},</p>
        <p>Congratulations — you have been added as an HR user in the ERP system.</p>
        <p>Your login credentials are:</p>
        <ul>
          <li>Username: <strong>${doc.username}</strong></li>
          <li>Password: <strong>${plainPassword}</strong></li>
        </ul>
        <p>You can login at: <a href="${loginLink}">${loginLink}</a></p>
        <p>Please change your password after your first login.</p>
        <p>Regards,<br/>Admin</p>`
      sendMail({ to: doc.username, subject, html }).catch(() => {})
    } catch (e) { /* ignore mail errors */ }

    return res.status(201).json({ ok: true, id: doc._id, username: doc.username, password: plainPassword })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.delete('/api/hr/:id', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const id = req.params.id
    if (!id) return res.status(400).json({ message: 'id required' })
    const user = await User.findById(id)
    if (!user) return res.status(404).json({ message: 'HR not found' })
    if (user.role !== 'staff' || !user.hr) return res.status(400).json({ message: 'Not an HR account' })
    await User.findByIdAndDelete(id)
    return res.json({ ok: true })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.put('/api/hr/:id/block', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const id = req.params.id
    const { block } = req.body || {}
    if (!id) return res.status(400).json({ message: 'id required' })
    const user = await User.findById(id)
    if (!user) return res.status(404).json({ message: 'HR not found' })
    if (user.role !== 'staff' || !user.hr) return res.status(400).json({ message: 'Not an HR account' })
    user.disabled = !!block
    await user.save()
    return res.json({ ok: true })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.put('/api/hr/:id', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const id = req.params.id
    const { contact, designation, name, fatherName, address } = req.body || {}
    if (!id) return res.status(400).json({ message: 'id required' })
    const user = await User.findById(id)
    if (!user) return res.status(404).json({ message: 'HR not found' })
    if (user.role !== 'staff' || !user.hr) return res.status(400).json({ message: 'Not an HR account' })
    if (contact !== undefined) user.contact = contact
    if (designation !== undefined) user.designation = designation
    if (name !== undefined) user.name = name
    if (fatherName !== undefined) user.fatherName = fatherName
    if (address !== undefined) user.address = address
    if (gender !== undefined) user.gender = gender
    if (age !== undefined) user.age = (age === '' || age === null) ? null : Number(age)
    if (religion !== undefined) user.religion = religion
    if (category !== undefined) user.category = category
    await user.save()
    return res.json({ ok: true, hr: { id: user._id, name: user.name, fatherName: user.fatherName, username: user.username, contact: user.contact, designation: user.designation, address: user.address, gender: user.gender || '', age: user.age || '', religion: user.religion || '', category: user.category || '' } })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: list parents
app.get('/api/parents', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const q = (req.query.q || '').trim()
    const base = { role: 'parent' }
    let filter = base
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'i')
      filter = { $and: [base, { $or: [ { name: re }, { username: re }, { contact: re }, { address: re } ] } ] }
    }
    let parents = await User.find(filter).select('name username disabled contact address createdAt parentOf avatar').sort({ createdAt: -1 }).lean()

    // Resolve parentOf entries to student names when they appear to be student IDs
    try {
      // Collect candidate ids across parents
      const idCandidates = new Set()
      parents.forEach(p => {
        if (Array.isArray(p.parentOf)) {
          p.parentOf.forEach(item => {
            if (typeof item === 'string' && /^[0-9a-fA-F]{24}$/.test(item)) idCandidates.add(item)
          })
        }
      })

      if (idCandidates.size > 0) {
        const ids = Array.from(idCandidates)
        const students = await Student.find({ _id: { $in: ids } }).select('name _id').lean()
        const idToName = {}
        students.forEach(s => { idToName[String(s._id)] = s.name })

        parents = parents.map(p => {
          if (!Array.isArray(p.parentOf) || p.parentOf.length === 0) return p
          const resolved = p.parentOf.map(item => {
            if (typeof item === 'string' && idToName[item]) return idToName[item]
            return item
          })
          return { ...p, parentOf: resolved }
        })
      }
    } catch (e) {
      // if resolving fails, ignore and return raw parentOf values
      console.warn('Failed to resolve parentOf student names:', e && e.message)
    }

    return res.json(parents)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: delete parent user
app.delete('/api/parents/:id', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const id = req.params.id
    if (!id) return res.status(400).json({ message: 'id required' })
    const user = await User.findById(id)
    if (!user) return res.status(404).json({ message: 'Parent not found' })
    if (user.role !== 'parent') return res.status(400).json({ message: 'Not a parent account' })
    // notify parent by email about deletion (best-effort)
    try {
      const loginUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || ''
      const subject = 'Account deleted by administrator'
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
      `
      await sendMail({ to: user.username, subject, html }).catch(() => {})
    } catch (mailErr) {
      console.warn('Failed to notify parent about deletion:', mailErr && (mailErr.message || String(mailErr)))
    }

    await User.deleteOne({ _id: id })
    return res.json({ ok: true })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: block/unblock parent
app.put('/api/parents/:id/block', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const id = req.params.id
    const { block } = req.body || {}
    if (!id) return res.status(400).json({ message: 'id required' })
    const user = await User.findById(id)
    if (!user) return res.status(404).json({ message: 'Parent not found' })
    if (user.role !== 'parent') return res.status(400).json({ message: 'Not a parent account' })
    user.disabled = !!block
    await user.save()

    // notify parent by email about block/unblock (best-effort)
    try {
      const loginUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || ''
      const action = block ? 'blocked' : 'unblocked'
      const subject = `Your account has been ${action}`
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
      `
      await sendMail({ to: user.username, subject, html }).catch(() => {})
    } catch (mailErr) {
      console.warn('Failed to notify parent about block/unblock:', mailErr && (mailErr.message || String(mailErr)))
    }

    return res.json({ ok: true })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: create parent user
app.post('/api/parents', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { name, email, contact, address, parentOf, avatar, password } = req.body || {}
    if (!name || !email || !password) return res.status(400).json({ message: 'name, email and password required' })
    const exists = await User.findOne({ username: email }).lean().catch(() => null)
    if (exists) return res.status(409).json({ message: 'User already exists' })
    const hashed = await bcrypt.hash(password, 10)
    const created = await User.create({ username: email, password: hashed, role: 'parent', name, contact: contact || '', address: address || '', parentOf: parentOf || [], avatar: avatar || '' })
    return res.status(201).json({ id: created._id, username: created.username, name: created.name })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Parent: link by student access code
app.post('/api/parents/link', verifyToken, requireRole('parent'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { code } = req.body || {}
    if (!code) return res.status(400).json({ message: 'code required' })
    const student = await Student.findOne({ parentAccessCode: String(code).trim().toUpperCase() }).lean().catch(() => null)
    if (!student) return res.status(404).json({ message: 'Invalid code' })

    const user = await User.findById(req.user.sub)
    if (!user || user.role !== 'parent') return res.status(403).json({ message: 'Unauthorized' })
    const sid = String(student._id)
    const exists = Array.isArray(user.parentOf) && user.parentOf.some(x => String(x) === sid)
    if (!exists) {
      if (!Array.isArray(user.parentOf)) user.parentOf = []
      user.parentOf.push(sid)
      await user.save()
    }
    return res.json({ ok: true, student: { id: student._id, name: student.name, class: student.class, section: student.section, email: student.email } })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Parent/Admin: get receipts by studentId
app.get('/api/finance/receipts/by-student/:id', verifyToken, requireRole(['admin','parent','faculty']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const id = req.params.id
    if (!id) return res.status(400).json({ message: 'student id required' })
    const student = await Student.findById(id).lean().catch(() => null)
    if (!student) return res.status(404).json({ message: 'Student not found' })
    if ((req.user && req.user.role) === 'parent') {
      const parent = await User.findById(req.user.sub).lean().catch(() => null)
      const linked = parent && Array.isArray(parent.parentOf) && parent.parentOf.some(x => String(x) === String(id))
      if (!linked) return res.status(403).json({ message: 'Parent is not linked to this student' })
    }
    // find receipts primarily by email (how receipts are recorded)
    const items = await Receipt.find({ $or: [ { studentEmail: student.email }, { studentId: student._id } ] }).sort({ createdAt: -1 }).lean()
    return res.json(items)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Parent/Admin: basic student info (limited fields)
app.get('/api/students/:id/basic', verifyToken, requireRole(['admin','parent']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const id = req.params.id
    if (!id) return res.status(400).json({ message: 'id required' })
    if ((req.user && req.user.role) === 'parent') {
      const parent = await User.findById(req.user.sub).lean().catch(() => null)
      const linked = parent && Array.isArray(parent.parentOf) && parent.parentOf.some(x => String(x) === String(id))
      if (!linked) return res.status(403).json({ message: 'Parent is not linked to this student' })
    }
    const s = await Student.findById(id).select('name class section email assignedFees').lean().catch(() => null)
    if (!s) return res.status(404).json({ message: 'Student not found' })
    return res.json(s)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: reject registration with optional note
app.put('/api/faculty/registrations/:id/reject', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { note } = req.body || {}
    const reg = await FacultyRegistration.findById(req.params.id)
    if (!reg) return res.status(404).json({ message: 'Registration not found' })
    reg.status = 'rejected'
    reg.note = note || ''
    await reg.save()
    return res.json(reg)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// protected profile
app.get('/api/profile', verifyToken, async (req, res) => {
  try {
    // try to return a DB-backed user profile when possible
    const uid = req.user && req.user.sub
    if (!uid) return res.json({ user: req.user })
    const user = await User.findById(uid).lean().catch(() => null)
    if (!user) return res.json({ user: req.user })

    // try to attach student/faculty records when available
    let student = null
    let faculty = null
    try { student = await Student.findById(uid).lean().catch(() => null) } catch (e) { student = null }
    try {
      faculty = await Faculty.findOne({ email: user.username }).lean().catch(() => null)
      if (!faculty && user.name) faculty = await Faculty.findOne({ name: user.name }).lean().catch(() => null)
      if (!faculty && user.contact) faculty = await Faculty.findOne({ contact: user.contact }).lean().catch(() => null)
    } catch (e) { faculty = null }

    return res.json({ user, student, faculty })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Update profile: updates User fields and tries to sync Student/Faculty when possible
app.put('/api/profile', verifyToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const uid = req.user && req.user.sub
    if (!uid) return res.status(400).json({ message: 'User id missing' })
    const payload = req.body || {}
    // Only allow a subset of fields
    const allowed = ['name', 'contact', 'address', 'avatar', 'email']
    const up = {}
    for (const k of allowed) if (payload[k] !== undefined) up[k] = payload[k]

    const updatedUser = await User.findByIdAndUpdate(uid, up, { new: true }).lean().catch(() => null)

    // try to update student/faculty records if present
    let updatedStudent = null
    let updatedFaculty = null
    try {
      let s = await Student.findById(uid).catch(() => null)
      if (s) {
        const su = {}
        if (up.name) su.name = up.name
        if (up.contact) su.contact = up.contact
        if (up.address) su.address = up.address
        if (Object.keys(su).length > 0) { s.set(su); await s.save(); updatedStudent = s.toObject() }
      }
    } catch (e) { /* ignore */ }
    try {
      let f = await Faculty.findOne({ email: updatedUser && updatedUser.username }).catch(() => null)
      if (!f && updatedUser && updatedUser.name) f = await Faculty.findOne({ name: updatedUser.name }).catch(() => null)
      if (f) {
        const fu = {}
        if (up.name) fu.name = up.name
        if (up.contact) fu.contact = up.contact
        if (up.address) fu.address = up.address
        if (Object.keys(fu).length > 0) { f.set(fu); await f.save(); updatedFaculty = f.toObject() }
      }
    } catch (e) { /* ignore */ }

    return res.json({ user: updatedUser, student: updatedStudent, faculty: updatedFaculty })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Password reset: request reset (creates token, emails user)
app.post('/api/password/forgot', async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { email } = req.body || {}
    if (!email) return res.status(400).json({ message: 'email required' })
    const user = await User.findOne({ username: email })
    if (!user) return res.status(404).json({ message: 'No account found with that email' })

    // generate token
    const crypto = require('crypto')
    const token = crypto.randomBytes(24).toString('hex')
    const expiresAt = new Date(Date.now() + (60 * 60 * 1000)) // 1 hour

    // remove existing tokens for user
    await PasswordReset.deleteMany({ userId: user._id }).catch(() => {})
    await PasswordReset.create({ userId: user._id, token, expiresAt })

    // send email with reset link
    try {
      const frontendBase = (process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || `http://localhost:${process.env.FRONTEND_PORT || 5173}`)
        .replace(/\/+$/g, '')
      const resetUrl = `${frontendBase}/reset-password?token=${token}`
      const subject = 'Password reset request'
      const html = `
        <div style="font-family:Arial,sans-serif;background:#f3f4f6;padding:20px;">
          <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
            <div style="background:linear-gradient(90deg,#f59e0b,#ef4444);padding:16px;color:white"><h2 style="margin:0">Password Reset</h2></div>
            <div style="padding:16px;color:#333"><p>Hi ${user.name || user.username},</p>
              <p>We received a request to reset your password. Click the button below to reset it. This link expires in 1 hour.</p>
              <p style="text-align:left;margin-top:12px"><a href="${resetUrl}" style="display:inline-block;padding:10px 14px;background:linear-gradient(90deg,#7c3aed,#06b6d4);color:#fff;border-radius:8px;text-decoration:none">Reset Password</a></p>
              <p style="margin-top:12px;color:#666;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
            </div>
          </div>
        </div>
      `
      await sendMail({ to: user.username, subject, html })
    } catch (mailErr) { console.warn('Failed to send password reset email:', mailErr && (mailErr.message || String(mailErr))) }

    return res.json({ ok: true })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Password reset: apply new password
app.post('/api/password/reset', async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { token, password } = req.body || {}
    if (!token || !password) return res.status(400).json({ message: 'token and password required' })
    const pr = await PasswordReset.findOne({ token })
    if (!pr) return res.status(400).json({ message: 'Invalid or expired token' })
    if (new Date() > pr.expiresAt) { await PasswordReset.deleteOne({ _id: pr._id }).catch(() => {}); return res.status(400).json({ message: 'Token expired' }) }

    const user = await User.findById(pr.userId)
    if (!user) return res.status(404).json({ message: 'User not found' })

    const hashed = await bcrypt.hash(password, 10)
    user.password = hashed
    await user.save()

    // cleanup tokens
    await PasswordReset.deleteMany({ userId: user._id }).catch(() => {})

    // send confirmation email
    try {
      const subject = 'Your password has been changed'
      const html = `
        <div style="font-family:Arial,sans-serif;background:#f3f4f6;padding:20px;">
          <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
            <div style="background:linear-gradient(90deg,#06b6d4,#7c3aed);padding:16px;color:white"><h2 style="margin:0">Password Changed</h2></div>
            <div style="padding:16px;color:#333"><p>Hi ${user.name || user.username},</p>
              <p>Your account password was successfully changed. If you did not perform this action, contact the administrator immediately.</p>
            </div>
          </div>
        </div>
      `
      await sendMail({ to: user.username, subject, html })
    } catch (mailErr) { console.warn('Failed to send password-changed email:', mailErr && (mailErr.message || String(mailErr))) }

    return res.json({ ok: true })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Finance endpoints

const CLASS_ROMAN_TO_NUMBER = {
  I: '1',
  II: '2',
  III: '3',
  IV: '4',
  V: '5',
  VI: '6',
  VII: '7',
  VIII: '8',
  IX: '9',
  X: '10',
  XI: '11',
  XII: '12'
}

const CLASS_NUMBER_TO_ROMAN = Object.fromEntries(Object.entries(CLASS_ROMAN_TO_NUMBER).map(([roman, number]) => [number, roman]))

function classAliases(value) {
  const raw = String(value || '').trim()
  if (!raw) return []
  const upper = raw.toUpperCase()
  return Array.from(new Set([raw, upper, CLASS_ROMAN_TO_NUMBER[upper], CLASS_NUMBER_TO_ROMAN[raw]].filter(Boolean)))
}

// Get fee structure (admin) - returns all class+section entries
app.get('/api/finance/fee-structure', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const items = await FeeStructure.find().lean()
    return res.json(items)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Public: get fee for a class/section (authenticated users)
app.get('/api/finance/fee-structure/public', verifyToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const cls = req.query.class || req.query.cls || req.query.k || null
    const section = req.query.section || req.query.sec || 'ALL'
    if (!cls) return res.json([])
    const classValues = classAliases(cls)
    // try exact section first
    let item = await FeeStructure.findOne({ class: { $in: classValues }, section }).lean()
    if (!item && section !== 'ALL') {
      // fallback to ALL
      item = await FeeStructure.findOne({ class: { $in: classValues }, section: 'ALL' }).lean()
    }
    if (!item) return res.json([])
    return res.json([item])
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Set or update fee for a class+section (creates history entry)
app.post('/api/finance/fee-structure', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { class: cls, section = 'ALL', term1 = 0, term2 = 0, note = '', term1DueDate = '', term2DueDate = '', term1FineMode = 'none', term1FineAmount = 0, term2FineMode = 'none', term2FineAmount = 0 } = req.body || {}
    if (!cls) return res.status(400).json({ message: 'class required' })
    const sec = section || 'ALL'
    const existing = await FeeStructure.findOne({ class: String(cls), section: sec })
    const actor = req.user && (req.user.name || req.user.username) || 'admin'
    if (existing) {
      // push history entry with previous values
      existing.history = existing.history || []
      existing.history.push({ by: actor, at: new Date(), term1: existing.term1, term2: existing.term2, note, term1DueDate: existing.term1DueDate || '', term2DueDate: existing.term2DueDate || '', term1FineMode: existing.term1FineMode || 'none', term1FineAmount: existing.term1FineAmount || 0, term2FineMode: existing.term2FineMode || 'none', term2FineAmount: existing.term2FineAmount || 0 })
      existing.term1 = Number(term1 || 0)
      existing.term2 = Number(term2 || 0)
      existing.term1DueDate = term1DueDate || ''
      existing.term2DueDate = term2DueDate || ''
      existing.term1FineMode = term1FineMode || 'none'
      existing.term1FineAmount = Number(term1FineAmount || 0)
      existing.term2FineMode = term2FineMode || 'none'
      existing.term2FineAmount = Number(term2FineAmount || 0)
      await existing.save()
      // Auto-propagate assignment to students for this class/section
      try {
        const studentQuery = { class: { $in: classAliases(cls) } }
        if (sec && sec !== 'ALL') studentQuery.section = sec
        // Term1 handling
        if (Number(term1 || 0) > 0) {
          const students = await Student.find(studentQuery).lean()
          for (const s of (students || [])) {
            const id = s._id
            const hasT1 = Array.isArray(s.assignedFees) && s.assignedFees.some(f => String(f.term).toLowerCase().replace(/\s+/g,'') === 'term1')
            if (hasT1) {
              await Student.updateOne({ _id: id, 'assignedFees.term': 'Term1' }, { $set: { 'assignedFees.$.amount': Number(term1), 'assignedFees.$.assignedAt': new Date(), 'assignedFees.$.by': actor } })
            } else {
              await Student.updateOne({ _id: id }, { $push: { assignedFees: { term: 'Term1', amount: Number(term1), note: String(note || ''), by: actor, assignedAt: new Date() } } })
            }
          }
        } else {
          // remove Term1 assignment if amount is 0
          await Student.updateMany(studentQuery, { $pull: { assignedFees: { term: 'Term1' } } })
        }
        // Term2 handling
        if (Number(term2 || 0) > 0) {
          const students = await Student.find(studentQuery).lean()
          for (const s of (students || [])) {
            const id = s._id
            const hasT2 = Array.isArray(s.assignedFees) && s.assignedFees.some(f => String(f.term).toLowerCase().replace(/\s+/g,'') === 'term2')
            if (hasT2) {
              await Student.updateOne({ _id: id, 'assignedFees.term': 'Term2' }, { $set: { 'assignedFees.$.amount': Number(term2), 'assignedFees.$.assignedAt': new Date(), 'assignedFees.$.by': actor } })
            } else {
              await Student.updateOne({ _id: id }, { $push: { assignedFees: { term: 'Term2', amount: Number(term2), note: String(note || ''), by: actor, assignedAt: new Date() } } })
            }
          }
        } else {
          // remove Term2 assignment if amount is 0
          await Student.updateMany(studentQuery, { $pull: { assignedFees: { term: 'Term2' } } })
        }
      } catch (propErr) { console.warn('Failed to auto-assign fees to students:', propErr && (propErr.message || String(propErr))) }
      return res.json(existing)
    }
    const created = await FeeStructure.create({ class: String(cls), section: sec, term1: Number(term1 || 0), term2: Number(term2 || 0), term1DueDate: term1DueDate || '', term2DueDate: term2DueDate || '', term1FineMode: term1FineMode || 'none', term1FineAmount: Number(term1FineAmount || 0), term2FineMode: term2FineMode || 'none', term2FineAmount: Number(term2FineAmount || 0), history: [{ by: actor, at: new Date(), term1: Number(term1 || 0), term2: Number(term2 || 0), note, term1DueDate: term1DueDate || '', term2DueDate: term2DueDate || '', term1FineMode: term1FineMode || 'none', term1FineAmount: Number(term1FineAmount || 0), term2FineMode: term2FineMode || 'none', term2FineAmount: Number(term2FineAmount || 0) }] })
    // Auto-propagate for newly created fee structure
    try {
      const studentQuery = { class: { $in: classAliases(cls) } }
      if (sec && sec !== 'ALL') studentQuery.section = sec
      if (Number(term1 || 0) > 0) await Student.updateMany(studentQuery, { $push: { assignedFees: { term: 'Term1', amount: Number(term1), note: String(note || ''), by: actor, assignedAt: new Date() } } })
      if (Number(term2 || 0) > 0) await Student.updateMany(studentQuery, { $push: { assignedFees: { term: 'Term2', amount: Number(term2), note: String(note || ''), by: actor, assignedAt: new Date() } } })
    } catch (propErr) { console.warn('Failed to auto-assign fees to students (create):', propErr && (propErr.message || String(propErr))) }
    return res.json(created)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Delete a specific history entry for a fee-structure (admin)
app.delete('/api/finance/fee-structure/:id/history/:hid', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { id, hid } = req.params
    if (!id || !hid) return res.status(400).json({ message: 'fee id and history id required' })

    // Load the document and manipulate history in JS to avoid ObjectId cast errors
    const fee = await FeeStructure.findById(id)
    if (!fee) return res.status(404).json({ message: 'Fee structure not found' })

    // Try to find by history _id string match
    let removed = false
    if (fee.history && fee.history.length) {
      // prefer exact _id match (compare as strings)
      const idx = fee.history.findIndex(h => String(h._id) === String(hid))
      if (idx >= 0) {
        fee.history.splice(idx, 1)
        removed = true
      }
    }

    // If not found, try interpreting hid as an ISO date string and match `at` timestamp
    if (!removed) {
      const maybeDate = new Date(hid)
      if (!isNaN(maybeDate.getTime())) {
        const before = fee.history.length
        fee.history = fee.history.filter(h => {
          const hAt = h.at ? new Date(h.at) : null
          return !(hAt && hAt.toISOString() === maybeDate.toISOString())
        })
        if (fee.history.length !== before) removed = true
      }
    }

    if (!removed) return res.status(404).json({ message: 'History entry not found' })

    await fee.save()
    const updated = await FeeStructure.findById(id).lean()
    return res.json({ ok: true, fee: updated })
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Admin: list receipts
app.get('/api/finance/receipts', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const items = await Receipt.find().sort({ createdAt: -1 }).lean()
    return res.json(items)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Student: get their receipts
app.get('/api/finance/receipts/my', verifyToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const items = await Receipt.find({ studentEmail: req.user.username }).sort({ createdAt: -1 }).lean()
    return res.json(items)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// NOTE: Student route consolidated earlier. Removed duplicate handler to avoid
// multiple handlers for the same path which can produce unexpected behavior.

// Create Razorpay order (requires RAZORPAY_KEY_ID and SECRET in env)
app.post('/api/finance/create-order', verifyToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { amount, currency = 'INR', receipt } = req.body || {}
    if (!amount) return res.status(400).json({ message: 'amount required' })
    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keyId || !keySecret) return res.status(500).json({ message: 'Razorpay not configured' })
    const Razorpay = require('razorpay')
    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret })
    const order = await rzp.orders.create({ amount: Math.round(Number(amount) * 100), currency, receipt: receipt || `rcpt_${Date.now()}` })
    console.log('Razorpay order created:', order && order.id, 'amount:', order && order.amount)
    return res.json(order)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Debug: report whether Razorpay env vars are present (development helper - does not return secrets)
app.get('/api/debug/razorpay', (req, res) => {
  try {
    const keyIdPresent = !!process.env.RAZORPAY_KEY_ID
    const keySecretPresent = !!process.env.RAZORPAY_KEY_SECRET
    return res.json({ ok: true, configured: keyIdPresent && keySecretPresent, keyIdPresent, keySecretPresent })
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message })
  }
})

// Assign a fee to students in a class/section (admin)
app.post('/api/finance/assign-fee', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { class: cls, section = 'ALL', term, amount = 0, note = '' } = req.body || {}
    if (!cls || !term) return res.status(400).json({ message: 'class and term required' })
    // Allow targeting specific student IDs (optional) or class/section filter
    let q = {}
    if (Array.isArray(req.body.studentIds) && req.body.studentIds.length) {
      q = { _id: { $in: req.body.studentIds } }
    } else {
      q = { class: { $in: classAliases(cls) } }
      if (section && section !== 'ALL') q.section = section
    }

    const students = await Student.find(q).lean()
    if (!students || students.length === 0) return res.status(404).json({ message: 'No students found for the selected filter' })

    const entry = { term: String(term), amount: Number(amount || 0), note: String(note || ''), by: (req.user && (req.user.name || req.user.username)) || 'admin', assignedAt: new Date() }

    // Push assignedFees entry to matching students
    const r = await Student.updateMany(q, { $push: { assignedFees: entry } })

    for (const student of students) {
      if (student.contact || student.email) {
        await notifyEvent({
          event: 'fee_due',
          phone: student.contact,
          message: `Dear ${student.name}, a new fee for Term ${term} (Amount: ${amount}) has been assigned to your account.`,
          emailOpts: { to: student.email, subject: 'Fee Due Notification', text: `Dear ${student.name}, a new fee for Term ${term} (Amount: ${amount}) has been assigned to your account.` }
        });
      }
    }
    return res.json({ ok: true, matched: r.matchedCount || r.n || 0, modified: r.modifiedCount || r.nModified || 0, assigned: entry })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Confirm payment (verify signature) and create Receipt
app.post('/api/finance/confirm-payment', verifyToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, studentId, studentName, studentEmail, class: cls, term, amount, allocationId } = req.body || {}
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return res.status(400).json({ message: 'payment details required' })
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    const crypto = require('crypto')
    const generatedSignature = crypto.createHmac('sha256', keySecret).update(razorpay_order_id + '|' + razorpay_payment_id).digest('hex')
    if (generatedSignature !== razorpay_signature) return res.status(400).json({ message: 'Invalid signature' })

    // create receipt record
    const rec = await Receipt.create({ studentId: studentId || null, allocationId: allocationId || null, studentName: studentName || '', studentEmail: studentEmail || (req.user && req.user.username) || '', class: cls || '', term: term || '', amount: Number(amount || 0), razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, razorpaySignature: razorpay_signature })

    // send receipt email to student if email present (with PDF attachment)
    try {
      const to = rec.studentEmail
      if (to) {
        const subject = `Payment receipt — ${rec.class} ${rec.term} — ₹${rec.amount}`
        const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || ''
        const html = `
          <div style="font-family:Arial,sans-serif;background:#f7f7fb;padding:20px">
            <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee">
              <div style="background:linear-gradient(90deg,#06b6d4,#7c3aed);padding:16px;color:white"><h2 style="margin:0">Payment Receipt</h2></div>
              <div style="padding:16px;color:#333">
                <p>Hi ${rec.studentName || rec.studentEmail},</p>
                <p>Thank you. Your payment has been received.</p>
                <table style="width:100%;border-collapse:collapse;margin-top:8px">
                  <tr><td style="font-weight:700;padding:6px 0">Receipt ID</td><td style="padding:6px 0">${rec._id}</td></tr>
                  <tr><td style="font-weight:700;padding:6px 0">Class</td><td style="padding:6px 0">${rec.class}</td></tr>
                  <tr><td style="font-weight:700;padding:6px 0">Term</td><td style="padding:6px 0">${rec.term}</td></tr>
                  <tr><td style="font-weight:700;padding:6px 0">Amount</td><td style="padding:6px 0">₹${rec.amount}</td></tr>
                  <tr><td style="font-weight:700;padding:6px 0">Date</td><td style="padding:6px 0">${new Date(rec.createdAt).toLocaleString()}</td></tr>
                </table>
                <p style="margin-top:12px">You can view your receipt online: <a href="${frontendUrl}/student/fees">View Receipts</a></p>
              </div>
            </div>
          </div>
        `
        // Generate PDF receipt server-side and attach (fire-and-forget)
        (async () => {
            try {
            // pdfkit require consolidated at top of file
            const buffers = []
            const doc = new PDFDocument({ size: 'A4', margin: 40 })
            doc.on('data', (b) => buffers.push(b))
            doc.on('end', async () => {
              try {
                const pdfData = Buffer.concat(buffers)
                await sendMail({ to, subject, html, attachments: [{ filename: `receipt_${rec._id}.pdf`, content: pdfData }] }).catch(() => {})
              } catch (e) { console.warn('Failed to send mail with attachment', e && (e.message || e)) }
            })
            // Write receipt content
            doc.fontSize(20).text('School Name', { align: 'left' })
            doc.moveDown(0.2)
            doc.fontSize(14).text('Hostel Fee Receipt', { align: 'left' })
            doc.moveDown(1)
            doc.fontSize(12).text(`Receipt ID: ${rec._id}`)
            doc.text(`Date: ${new Date(rec.createdAt).toLocaleString()}`)
            doc.moveDown(0.5)
            doc.fontSize(12).text(`Student: ${rec.studentName || ''}`)
            doc.text(`Email: ${rec.studentEmail || ''}`)
            doc.text(`Class: ${rec.class || ''}`)
            doc.text(`Term: ${rec.term || ''}`)
            doc.moveDown(0.5)
            // If we have allocation info, include it
            try {
              if (rec.allocationId) {
                const alloc = await HostelAllocation.findById(rec.allocationId).lean().catch(() => null)
                if (alloc) {
                  const hostel = (alloc.hostelId && await Hostel.findById(alloc.hostelId).lean().catch(() => null)) || null
                  doc.moveDown(0.5)
                  doc.text(`Hostel: ${hostel ? (hostel.name || '') : (alloc.hostelId || '')}`)
                  doc.text(`Room: ${alloc.floorNo} / ${alloc.roomNo} / ${Number(alloc.bedIndex) + 1}`)
                }
              }
            } catch (e) { }
            doc.moveDown(1)
            doc.fontSize(14).text(`Amount Paid: ₹${rec.amount}`, { underline: true })
            doc.end()
          } catch (e) { console.warn('Failed to generate PDF receipt', e && (e.message || e)) }
        })()
        // send lightweight email without attachments immediately (attachment arrives asynchronously above)
        await sendMail({ to, subject, html }).catch(() => {})
      }
    } catch (mailErr) { console.warn('Failed to send receipt email:', mailErr && (mailErr.message || String(mailErr))) }

    // If this receipt references a hostel allocation, update that allocation's payments and paid flag
    try {
      if (allocationId) {
        const alloc = await HostelAllocation.findById(allocationId).catch(() => null)
        if (alloc) {
          // determine part index from term string e.g., 'Term 1'
          let partIndex = null
          try { const m = String(term || '').match(/(\d+)/); if (m) partIndex = Number(m[1]) } catch (e) { partIndex = null }
          // initialize payments array if missing
          const payments = Array.isArray(alloc.payments) ? alloc.payments : []
          // if we have partIndex, check for existing entry and update; otherwise push a generic payment
          if (partIndex !== null) {
            const exists = payments.find(p => Number(p.partIndex) === Number(partIndex) && p.paymentId === String(razorpay_payment_id))
            if (!exists) {
              payments.push({ partIndex: Number(partIndex), amount: Number(amount || 0), orderId: razorpay_order_id, paymentId: razorpay_payment_id, receiptId: rec._id, status: 'paid' })
            }
          } else {
            payments.push({ amount: Number(amount || 0), orderId: razorpay_order_id, paymentId: razorpay_payment_id, receiptId: rec._id, status: 'paid' })
          }
          // compute whether all parts are paid
          let paidAll = false
          try {
            const partsCount = alloc.fee && alloc.fee.parts ? Number(alloc.fee.parts) : 1
            const paidCount = payments.filter(p => p && p.status === 'paid' && p.partIndex).length
            // if parts specified and paidCount >= partsCount then mark paid
            if (partsCount && paidCount >= partsCount) paidAll = true
            // if partsCount == 1 and we have any paid payment, mark paidAll
            if (partsCount === 1 && payments.length > 0) paidAll = true
          } catch (e) { paidAll = false }
          await HostelAllocation.findByIdAndUpdate(allocationId, { $set: { payments: payments, paid: !!paidAll } }).catch(() => null)
        }
      }
    } catch (e) { console.warn('Failed to update allocation from receipt', e && (e.message || e)) }

    // emit SSE for admin UIs
    try { sendSseEvent('receipt_created', { id: rec._id, email: rec.studentEmail, name: rec.studentName, amount: rec.amount }) } catch (e) {}

    return res.json({ ok: true, receipt: rec })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// admin-only route example
app.get('/api/admin/dashboard', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    // Total number of students
    const studentsCount = await Student.countDocuments().catch(() => 0)

    // Total number of teachers/faculty
    const teachersCount = await Faculty.countDocuments().catch(() => 0)

    // Number of distinct classes (from students)
    let classesCount = 0
    try {
      const classes = await Student.distinct('class')
      classesCount = Array.isArray(classes) ? classes.filter(Boolean).length : 0
    } catch (e) { classesCount = 0 }

    // Total fee collection (sum of receipts.amount)
    let feesTotal = 0
    try {
      const agg = await Receipt.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }])
      feesTotal = (agg && agg[0] && agg[0].total) ? agg[0].total : 0
    } catch (e) { feesTotal = 0 }

    return res.json({ students: studentsCount, teachers: teachersCount, classes: classesCount, fees: feesTotal })
  } catch (e) {
    // In case of unexpected error, return a friendly message
    return res.status(500).json({ message: 'Failed to prepare dashboard metrics', error: e && e.message })
  }
})

// Complaints
app.post('/api/complaints', verifyToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  const { text, priority } = req.body || {}
  if (!text) return res.status(400).json({ message: 'text required' })
  try {
    const c = await Complaint.create({ userId: req.user.sub, username: req.user.username, text, priority })
    return res.status(201).json(c)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

app.get('/api/complaints', verifyToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    if (req.user.role === 'admin') {
      const all = await Complaint.find().sort({ createdAt: -1 }).lean()
      return res.json(all)
    }
    const mine = await Complaint.find({ userId: req.user.sub }).sort({ createdAt: -1 }).lean()
    return res.json(mine)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

app.put('/api/complaints/:id/status', verifyToken, requireRole('admin'), async (req, res) => {
  const { status, note } = req.body || {}
  if (!status) return res.status(400).json({ message: 'status required' })
  try {
    const c = await Complaint.findById(req.params.id)
    if (!c) return res.status(404).json({ message: 'Complaint not found' })
    // push history entry
    // Prefer storing the user's display name when available, fallback to username or id
    const displayBy = req.user.name || req.user.username || req.user.sub
    const entry = { by: displayBy, role: req.user.role || 'admin', note: note || '', status, at: new Date() }
    c.status = status
    c.history = c.history || []
    c.history.push(entry)
    const saved = await c.save()
    return res.json(saved)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Events
app.post('/api/events', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  const { title, description, date } = req.body || {}
  if (!title || !date) return res.status(400).json({ message: 'title and date required' })
  try {
    const ev = await Event.create({ title, description, date: new Date(date), createdBy: req.user.sub })
    return res.status(201).json(ev)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

app.get('/api/events', async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const items = await Event.find().sort({ date: 1 }).lean()
    return res.json(items)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Meetings
// Admin can create meetings targeted to students (all / class / section / specific student)
app.post('/api/meetings', verifyToken, requireRole(['admin','faculty']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { title, summary, datetime, link, audience = 'students', class: cls, section, studentId } = req.body || {}
    if (!title || !datetime) return res.status(400).json({ message: 'title and datetime required' })
    // If a faculty is creating a meeting targeted to students, ensure they are assigned to that class/section
    if (req.user && req.user.role === 'faculty' && (audience === 'student' || audience === 'students')) {
      const u = await User.findById(req.user.sub).lean().catch(() => null)
      if (!u) return res.status(403).json({ message: 'Unauthorized' })
      let fac = await Faculty.findOne({ email: u.username }).lean().catch(() => null)
      if (!fac && u.name) fac = await Faculty.findOne({ name: u.name }).lean().catch(() => null)
      if (!fac && u.contact) fac = await Faculty.findOne({ contact: u.contact }).lean().catch(() => null)
      if (!fac) return res.status(403).json({ message: 'Faculty record not linked' })
      const clsStr = String(cls || '')
      const secStr = String(section || '')
      let allowed = false
      for (const a of fac.assignments || []) {
        if (String(a.class) !== clsStr) continue
        if (a.isClassTeacher) { allowed = true; break }
        if (a.section && String(a.section) === secStr) { allowed = true; break }
      }
      if (!allowed) return res.status(403).json({ message: 'Not assigned to this class/section' })
    }
    const m = await Meeting.create({ title, summary, datetime: new Date(datetime), link, audience, class: cls, section, studentId, createdBy: req.user.sub })
    // notify SSE clients
    try { sendSseEvent('meeting_created', { id: m._id, title: m.title }) } catch (e) {}
    return res.status(201).json(m)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: list meetings
app.get('/api/meetings', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    // populate createdBy name so admin sees who created the meeting
    const items = await Meeting.find().sort({ datetime: -1 }).populate('createdBy', 'name').lean()
    return res.json(items)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// My meetings - for students (and generic for other roles)
app.get('/api/meetings/my', verifyToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const role = req.user.role || 'student'
    if (role === 'student') {
      // find student's record by email (username)
      const userEmail = req.user.username
      const studentDoc = await Student.findOne({ email: userEmail }).lean()
      const now = new Date()
      const q = { datetime: { $gte: now } }
      // match audience: all OR student(s) (either singular/plural) OR targeted to this class/section OR specific studentId
      const or = [
        { audience: 'all' },
        { audience: 'students', class: { $exists: false } },
        { audience: 'student', class: { $exists: false } },
        { audience: 'students' },
        { audience: 'student' }
      ]
      // build more specific matches
      const specific = []
      if (studentDoc) {
        specific.push({ audience: 'students', class: studentDoc.class })
        specific.push({ audience: 'student', class: studentDoc.class })
        if (studentDoc.section) {
          specific.push({ audience: 'students', class: studentDoc.class, section: studentDoc.section })
          specific.push({ audience: 'student', class: studentDoc.class, section: studentDoc.section })
        }
        specific.push({ audience: 'student', studentId: studentDoc._id })
      }
      const finalOr = or.concat(specific)
      // deduplicate simple: use $or with constructed array
      q.$or = finalOr
      const items = await Meeting.find(q).sort({ datetime: 1 }).lean()
      return res.json(items)
    }
    // non-students: faculty should also see meetings targeted to students in their assigned classes
    if (role === 'faculty') {
      // resolve faculty record
      const u = await User.findById(req.user.sub).lean().catch(() => null)
      let fac = null
      if (u) {
        fac = await Faculty.findOne({ email: u.username }).lean().catch(() => null)
        if (!fac && u.name) fac = await Faculty.findOne({ name: u.name }).lean().catch(() => null)
        if (!fac && u.contact) fac = await Faculty.findOne({ contact: u.contact }).lean().catch(() => null)
      }
      // base items: audience all, audience faculty, audience role plural, and createdBy
      const rolePlural = `${req.user.role}s`
      const baseQ = { $or: [{ audience: 'all' }, { audience: req.user.role }, { audience: rolePlural }, { createdBy: req.user.sub }] }
      let items = await Meeting.find(baseQ).sort({ datetime: 1 }).lean()
      // include meetings targeted to students for classes/sections the faculty is assigned to
      if (fac && Array.isArray(fac.assignments) && fac.assignments.length > 0) {
        const orClauses = []
        for (const a of fac.assignments || []) {
          if (!a.class) continue
          orClauses.push({ audience: 'students', class: String(a.class) })
          orClauses.push({ audience: 'student', class: String(a.class) })
          if (a.section) {
            orClauses.push({ audience: 'students', class: String(a.class), section: String(a.section) })
            orClauses.push({ audience: 'student', class: String(a.class), section: String(a.section) })
          }
        }
        if (orClauses.length > 0) {
          const studentMeetings = await Meeting.find({ $or: orClauses }).sort({ datetime: 1 }).lean()
          items = items.concat(studentMeetings)
          // deduplicate by _id
          const seen = new Set()
          items = items.filter(it => { if (!it || !it._id) return false; const id = String(it._id); if (seen.has(id)) return false; seen.add(id); return true })
        }
      }
      return res.json(items)
    }
    // other roles: return meetings addressed to all or role and those created by the user
    const rolePlural = `${req.user.role}s`
    const items = await Meeting.find({ $or: [{ audience: 'all' }, { audience: req.user.role }, { audience: rolePlural }, { createdBy: req.user.sub }] }).sort({ datetime: 1 }).lean()
    return res.json(items)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Students - list/filter (admin or faculty)
app.get('/api/students', verifyToken, requireRole(['admin', 'faculty']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { name, class: className, section, email, house, gender, category, religion } = req.query || {}
    const q = {}
    if (name) q.name = { $regex: name, $options: 'i' }
    if (className) q.class = String(className)
    if (section) q.section = String(section)
    if (email) q.email = { $regex: email, $options: 'i' }
    if (house) q.house = String(house)
    if (gender) q.gender = String(gender)
    if (category) q.category = String(category)
    if (religion) q.religion = String(religion)
    let items = await Student.find(q).sort({ class: 1, section: 1, rollNo: 1 }).lean()
    // enrich with blocked status from User collection (if a user exists with same email)
    try {
      const emails = items.map(i => i.email).filter(Boolean)
      const users = emails.length ? await User.find({ username: { $in: emails } }).lean() : []
      const userMap = {}
      for (const u of users) userMap[u.username] = u
      items = items.map(i => {
        const userDisabled = !!(i.email && userMap[i.email] && userMap[i.email].disabled)
        const studentBlocked = !!(i.blocked)
        return { ...i, blocked: userDisabled || studentBlocked }
      })
    } catch (e) {
      // if enrichment fails, return items as-is
    }
    return res.json(items)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Admin: create student directly (auto-assign section and rollNo, create login user and email credentials)
app.post('/api/students', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { name, email, class: className, password, gender = '', category = '', religion = '', medium = 'English', house = '' } = req.body || {}
    if (!name || !email || !className) return res.status(400).json({ message: 'name, email and class required' })

    // prevent duplicate usage of the same email across ERP
    const existingStudent = await Student.findOne({ email }).lean().catch(() => null)
    if (existingStudent) return res.status(409).json({ message: 'Student with this email already exists' })
    const existingUserAnyRole = await User.findOne({ username: email }).lean().catch(() => null)
    if (existingUserAnyRole) return res.status(409).json({ message: 'This email is already in use for another account' })

    // assign section by finding first section with capacity < 50
    const sections = ['A','B','C','D']
    let assignedSection = null
    for (const s of sections) {
      const count = await Student.countDocuments({ class: String(className), section: s }).catch(() => 0)
      if (count < 50) { assignedSection = s; break }
    }
    if (!assignedSection) return res.status(400).json({ message: 'Class is full or no section available' })

    // compute roll number: class + section + next number
    const existingCount = await Student.countDocuments({ class: String(className), section: assignedSection }).catch(() => 0)
    const rollNo = `${String(className)}${assignedSection}${existingCount + 1}`

    // create student record
    let studentDoc
    try {
      studentDoc = await Student.create({ name, email, class: String(className), section: assignedSection, rollNo, gender: String(gender), category: String(category), religion: String(religion), medium: medium || 'English', ...(house ? { house: String(house) } : {}) })
    } catch (err) {
      if (err && (err.code === 11000 || /duplicate key/i.test(String(err.message)))) {
        return res.status(409).json({ message: 'Student with this email already exists' })
      }
      throw err
    }

    // create login user for student if not exists
    let user = await User.findOne({ username: email })
    let generatedPassword = null
    if (!user) {
      if (password && String(password).trim().length >= 4) {
        generatedPassword = String(password)
      } else {
        generatedPassword = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 90 + 10)
      }
      const hashed = await bcrypt.hash(generatedPassword, 10)
      try {
        user = await User.create({ username: email, password: hashed, role: 'student', name })
      } catch (err) {
        if (err && (err.code === 11000 || /duplicate key/i.test(String(err.message)))) {
          // Username already exists; keep existing user reference
          user = await User.findOne({ username: email })
        } else {
          throw err
        }
      }
    }

    // send welcome email with credentials (if SMTP configured)
    try {
      const loginUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || ''
      const subject = 'Welcome — your student account has been created'
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
      `
      await sendMail({ to: email, subject, html })
    } catch (mailErr) { console.warn('Failed to send student creation email:', mailErr && (mailErr.message || String(mailErr))) }

    // SSE notify admin UI
    try { sendSseEvent('student_created', { id: studentDoc._id, name: studentDoc.name, email: studentDoc.email, class: studentDoc.class, section: studentDoc.section }) } catch (e) {}

    return res.status(201).json({ student: studentDoc.toObject(), user: user ? { id: user._id, username: user.username } : null })
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Create an assignment (faculty)
app.post('/api/assignments', verifyToken, requireRole('faculty'), upload.single('file'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { subject, title, description, class: cls, section = 'ALL', dueDate } = req.body || {}
    if (!title || !cls) return res.status(400).json({ message: 'title and class required' })
    // Ensure faculty is assigned to this class/section
    if (req.user && req.user.role === 'faculty') {
      const u = await User.findById(req.user.sub).lean().catch(() => null)
      if (!u) return res.status(403).json({ message: 'Unauthorized' })
      let fac = await Faculty.findOne({ email: u.username }).lean().catch(() => null)
      if (!fac && u.name) fac = await Faculty.findOne({ name: u.name }).lean().catch(() => null)
      if (!fac && u.contact) fac = await Faculty.findOne({ contact: u.contact }).lean().catch(() => null)
      if (!fac) return res.status(403).json({ message: 'Faculty record not linked' })
      let allowed = false
      for (const a of fac.assignments || []) {
        if (String(a.class) !== String(cls)) continue
        if (a.isClassTeacher) { allowed = true; break }
        if (a.section && String(a.section) === String(section)) { allowed = true; break }
      }
      if (!allowed) return res.status(403).json({ message: 'Not assigned to this class/section' })
    }
    const doc = await Assignment.create({ subject, title, description, class: String(cls), section: section || 'ALL', dueDate: dueDate ? new Date(dueDate) : null, createdBy: req.user && req.user.sub })
    // attach uploaded file path as metadata (not stored on schema currently)
    if (req.file) { doc.filePath = `/uploads/${req.file.filename}` }
    await doc.save()
    // emit SSE for students (optional)
    try { sendSseEvent('assignment_created', { id: doc._id, class: doc.class, section: doc.section }) } catch (e) {}
    return res.status(201).json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// List assignments (students and faculty). Query by class and section.
app.get('/api/assignments', verifyToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const cls = req.query.class || req.query.cls || null
    const section = req.query.section || req.query.sec || null
    const q = {}
    if (cls) q.class = String(cls)
    // match either the specific section or 'ALL'
    if (section) q.$or = [{ section }, { section: 'ALL' }]
    const items = await Assignment.find(q).sort({ createdAt: -1 }).lean()
    return res.json(items)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Test Management
// Create a test series (admin or faculty). Supports optional file upload (e.g., CSV or resources)
app.post('/api/tests', verifyToken, requireRole(['admin','faculty']), upload.single('file'), async (req, res) => {
  try {
    const { title, subject, term, type = 'google_form', link, classes, sections, start, durationMinutes, attempts, description } = req.body || {}
    if (!title) return res.status(400).json({ message: 'title required' })
    // require durationMinutes (must be a positive number)
    const dur = durationMinutes ? Number(durationMinutes) : null
    if (!dur || isNaN(dur) || dur <= 0) return res.status(400).json({ message: 'durationMinutes required and must be a positive number' })
    const cls = Array.isArray(classes) ? classes : (classes ? String(classes).split(',').map(s => s.trim()).filter(Boolean) : [])
    const secs = Array.isArray(sections) ? sections : (sections ? String(sections).split(',').map(s => s.trim()).filter(Boolean) : [])
    const file = req.file
    const filePath = file ? `/uploads/${file.filename}` : ''

    if (!dbConnected) {
      // create in-memory test for development without DB
      const t = { _id: makeId('t_'), title, subject: subject || '', term: term || 'Term 1', type, link: link || '', filePath, classes: cls, sections: secs, start: start ? new Date(start) : null, durationMinutes: Number(durationMinutes), attempts: attempts ? Number(attempts) : 1, description: description || '', createdBy: req.user.sub, createdAt: new Date(), updatedAt: new Date() }
      inMemoryTests.push(t)
      return res.status(201).json(t)
    }

    const doc = await TestSeries.create({
      title,
      subject: subject || '',
      term: term || 'Term 1',
      type,
      link: link || '',
      filePath,
      classes: cls,
      sections: secs,
      start: start ? new Date(start) : null,
      durationMinutes: Number(durationMinutes),
      attempts: attempts ? Number(attempts) : 1,
      description: description || '',
      createdBy: req.user.sub
    })
    return res.status(201).json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: list all tests
app.get('/api/tests', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    if (!dbConnected) return res.json(inMemoryTests)
    const items = await TestSeries.find().sort({ start: -1 }).populate('createdBy', 'name role').lean()
    return res.json(items)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Update a test series (admin or faculty). Faculty may only update tests they created.
app.put('/api/tests/:id', verifyToken, requireRole(['admin','faculty']), async (req, res) => {
  try {
    if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
    const id = req.params.id
    const t = await TestSeries.findById(id)
    if (!t) return res.status(404).json({ message: 'Test series not found' })

    // If faculty, ensure they are the creator
    if (req.user.role === 'faculty' && (!t.createdBy || String(t.createdBy) !== String(req.user.sub))) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const allowed = ['title','subject','term','type','link','filePath','classes','sections','start','durationMinutes','attempts','description']
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        // normalize arrays for classes/sections
        if ((k === 'classes' || k === 'sections') && Array.isArray(req.body[k])) t[k] = req.body[k]
        else if ((k === 'classes' || k === 'sections') && typeof req.body[k] === 'string') t[k] = String(req.body[k]).split(',').map(s => s.trim()).filter(Boolean)
        else if (k === 'durationMinutes' || k === 'attempts') t[k] = Number(req.body[k] || 0)
        else if (k === 'start') t[k] = req.body[k] ? new Date(req.body[k]) : null
        else t[k] = req.body[k]
      }
    }

    await t.save()
    return res.json(t)
  } catch (e) {
    return res.status(500).json({ message: e && e.message ? e.message : String(e) })
  }
})

// Delete a test series (admin or faculty who created it)
app.delete('/api/tests/:id', verifyToken, requireRole(['admin','faculty']), async (req, res) => {
  try {
    const id = req.params.id
    if (!dbConnected) {
      // remove from in-memory tests
      const idx = inMemoryTests.findIndex(t => String(t._id) === String(id))
      if (idx === -1) return res.status(404).json({ message: 'Test series not found' })
      // if faculty, ensure they created it (in-memory items may not have createdBy)
      const role = req.user && req.user.role
      if (role === 'faculty') {
        const it = inMemoryTests[idx]
        if (it.createdBy && String(it.createdBy) !== String(req.user.sub)) return res.status(403).json({ message: 'Forbidden' })
      }
      inMemoryTests.splice(idx, 1)
      return res.json({ message: 'Deleted' })
    }

    const t = await TestSeries.findById(id)
    if (!t) return res.status(404).json({ message: 'Test series not found' })

    // If faculty, ensure they are the creator
    if (req.user.role === 'faculty' && (!t.createdBy || String(t.createdBy) !== String(req.user.sub))) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    // delete related questions and results, then delete the test document
    await Question.deleteMany({ testId: id }).catch(() => {})
    await TestResult.deleteMany({ test: id }).catch(() => {})
    await TestSeries.deleteOne({ _id: id }).catch(() => {})
    return res.json({ message: 'Deleted' })
  } catch (e) {
    return res.status(500).json({ message: e && e.message ? e.message : String(e) })
  }
})

// Get tests relevant to the requesting user (faculty/admin see created or all, students see assigned)
app.get('/api/tests/my', verifyToken, async (req, res) => {
  try {
    const role = req.user.role || 'student'
    if (!dbConnected) {
      // Development mode: return in-memory tests for everyone so students can try the flow
      return res.json(inMemoryTests)
    }
    if (role === 'admin') {
      const items = await TestSeries.find().sort({ start: -1 }).lean()
      // enrich with totalQuestions
      try {
        const counts = await Promise.all((items || []).map(it => Question.countDocuments({ testId: it._id }).catch(() => 0)))
        ;(items || []).forEach((it, i) => { it.totalQuestions = counts[i] || 0 })
      } catch (e) { /* ignore counts errors */ }
      return res.json(items)
    }
    if (role === 'faculty') {
      const items = await TestSeries.find({ $or: [{ createdBy: req.user.sub }] }).sort({ start: -1 }).lean()
      try {
        const counts = await Promise.all((items || []).map(it => Question.countDocuments({ testId: it._id }).catch(() => 0)))
        ;(items || []).forEach((it, i) => { it.totalQuestions = counts[i] || 0 })
      } catch (e) { }
      return res.json(items)
    }
    // student: return tests assigned to student's class/section or to all (classes=[] means all)
    const userEmail = req.user.username
    const studentDoc = await Student.findOne({ email: userEmail }).lean().catch(() => null)
    const now = new Date()
    const q = {}
    // optional: only upcoming or recent tests; for now return all assigned
    const orClauses = []
    // tests with no classes (target all students)
    orClauses.push({ classes: { $size: 0 } })
    orClauses.push({ classes: { $exists: false } })
    if (studentDoc) {
      orClauses.push({ classes: studentDoc.class })
      orClauses.push({ classes: { $in: [studentDoc.class] } })
      if (studentDoc.section) {
        orClauses.push({ sections: { $in: [studentDoc.section] } })
        orClauses.push({ sections: studentDoc.section })
      }
    }
    q.$or = orClauses
    const items = await TestSeries.find(q).sort({ start: 1 }).lean()
    try {
      const counts = await Promise.all((items || []).map(it => Question.countDocuments({ testId: it._id }).catch(() => 0)))
      ;(items || []).forEach((it, i) => { it.totalQuestions = counts[i] || 0 })
    } catch (e) { }
    return res.json(items)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Get results for a test (admin or faculty)
app.get('/api/tests/:id/results', verifyToken, requireRole(['admin','faculty']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const testId = req.params.id
    // If faculty, ensure they created the test
    if (req.user.role === 'faculty') {
      const testDoc = await TestSeries.findById(testId).lean()
      if (!testDoc) return res.status(404).json({ message: 'Test not found' })
      if (!testDoc.createdBy || String(testDoc.createdBy) !== String(req.user.sub)) return res.status(403).json({ message: 'Forbidden' })
    }
    const items = await TestResult.find({ test: testId }).sort({ submittedAt: -1 }).lean()
    return res.json(items)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Subjective review routes removed (feature deleted)

// Return questions for a test - allow student, admin and faculty (do not expose correct answers to students)
// Admins/faculty can also fetch questions for management purposes; correct answers are not included here.
app.get('/api/tests/:id/questions', verifyToken, requireRole(['student','admin','faculty']), async (req, res) => {
  try {
    const testId = req.params.id
    // Allow admin/faculty to fetch questions for management — skip availability/attempt checks for them
    const now = new Date()
    const startedParam = String(req.query && req.query.started || '').toLowerCase() === 'true'
    if (dbConnected) {
      const tdoc = await TestSeries.findById(testId).lean()
      if (!tdoc) return res.status(404).json({ message: 'Test not found' })

      const userRole = req.user && req.user.role
      // If not admin/faculty, enforce start/end and attempt rules
      if (!(userRole === 'admin' || userRole === 'faculty')) {
        // Allow a student to initiate their attempt (per-student start) by passing ?started=true
        // If startedParam is true, treat the student's start time as now (override test-level start)
        let start = tdoc.start ? new Date(tdoc.start) : null
        if (startedParam) start = now
        if (start) {
          if (now < start) return res.status(403).json({ message: 'Test has not started yet' })
          if (tdoc.durationMinutes) {
            const end = new Date(start.getTime() + Number(tdoc.durationMinutes) * 60000)
            if (now > end) return res.status(403).json({ message: 'Test has ended' })
          }
        }

        // check if student already submitted
        const username = req.user && req.user.username
        const studentDoc = await Student.findOne({ email: username }).lean().catch(() => null)
        // count previous attempts and compare to allowed attempts on the test
        const allowedAttempts = tdoc.attempts ? Number(tdoc.attempts) : 1
        let attemptsCount = 0
        if (dbConnected) {
          attemptsCount = await TestResult.countDocuments({ test: testId, $or: [{ email: username }, { studentId: studentDoc && studentDoc._id }] }).catch(() => 0)
        } else {
          attemptsCount = inMemoryTestsResults.filter(r => String(r.test) === String(testId) && (r.email === username || String(r.studentId) === String(studentDoc && studentDoc._id))).length
        }
        if (attemptsCount >= allowedAttempts) return res.status(403).json({ message: 'You have already attempted this test' })
      }

      const qs = await Question.find({ testId }).lean()
      const out = (qs || []).map(q => {
        // For admin/faculty include correctAnswer and explanation so they can manage questions.
        if (userRole === 'admin' || userRole === 'faculty') {
          return { _id: q._id, questionText: q.questionText, questionImage: q.questionImage || '', options: q.options, optionImages: Array.isArray(q.optionImages) ? q.optionImages : [], marks: q.marks, correctAnswer: q.correctAnswer || '', explanation: q.explanation || '' }
        }
        // Students do not receive correctAnswer/explanation
        return { _id: q._id, questionText: q.questionText, questionImage: q.questionImage || '', options: q.options, optionImages: Array.isArray(q.optionImages) ? q.optionImages : [], marks: q.marks }
      })
      return res.json(out)
    } else {
      const qs = inMemoryQuestions.filter(q => String(q.testId) === String(testId))
      const out = qs.map(q => ({ _id: q._id, questionText: q.questionText, options: q.options, marks: q.marks }))
      return res.json(out)
    }
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Student submits answers for a test; server grades and stores a TestResult
app.post('/api/tests/:id/submit', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const testId = req.params.id
    const { answers, candidate } = req.body || {}
    if (!Array.isArray(answers)) return res.status(400).json({ message: 'answers array required' })

    // check test availability and duplicate submission
    const now = new Date()
    if (dbConnected) {
      const tdoc = await TestSeries.findById(testId).lean()
      if (!tdoc) return res.status(404).json({ message: 'Test not found' })
      // Support per-student start when client indicates they started the test (body.isStarted===true)
      const startedBody = req.body && req.body.isStarted
      let start = tdoc.start ? new Date(tdoc.start) : null
      if (startedBody) start = now
      if (start) {
        if (now < start) return res.status(403).json({ message: 'Test has not started yet' })
        if (tdoc.durationMinutes) {
          const end = new Date(start.getTime() + Number(tdoc.durationMinutes) * 60000)
          // allow a small grace window (12s) for finalisation/auto-submit
          const graceMs = 12000
          if (now > new Date(end.getTime() + graceMs)) return res.status(403).json({ message: 'Test has ended' })
        }
      }

      const username = req.user && req.user.username
      const studentDoc = await Student.findOne({ email: username }).lean().catch(() => null)
      // count previous attempts and allow submission only if attempts < allowed
      const allowedAttempts2 = tdoc.attempts ? Number(tdoc.attempts) : 1
      let prevCount = 0
      if (dbConnected) {
        prevCount = await TestResult.countDocuments({ test: testId, $or: [{ email: username }, { studentId: studentDoc && studentDoc._id }] }).catch(() => 0)
      } else {
        prevCount = inMemoryTestsResults.filter(r => String(r.test) === String(testId) && (r.email === username || String(r.studentId) === String(studentDoc && studentDoc._id))).length
      }
      if (prevCount >= allowedAttempts2) return res.status(403).json({ message: 'You have already submitted this test' })
    }

    // load questions
    let qs = []
    if (!dbConnected) {
      qs = inMemoryQuestions.filter(q => String(q.testId) === String(testId))
    } else {
      qs = await Question.find({ testId }).lean()
    }

    if (!qs || !qs.length) return res.status(400).json({ message: 'No questions found for this test' })

    // build map
    const qmap = {}
    let totalMarks = 0
    for (const q of qs) { qmap[String(q._id)] = q; totalMarks += Number(q.marks || 1) }

    let score = 0
    const details = []
    let hasSubjective = false
    for (const a of answers) {
      const qid = String(a.questionId || a.q || '')
      const ans = a.answer || a.selected || ''
      const q = qmap[qid]
      if (!q) continue
      const correct = q.correctAnswer || ''
      const opts = Array.isArray(q.options) ? q.options.filter(Boolean) : []
      let awarded = 0
      let matched = false
      let matchedPercentage = null

      if (opts && opts.length) {
        // MCQ: exact match (case-insensitive)
        matched = String(ans || '').trim().toLowerCase() === String(correct || '').trim().toLowerCase()
        if (matched) awarded = Number(q.marks || 1)
      } else {
        hasSubjective = true
        // Subjective: compute similarity (enhanced: char + word-level)
        const sim = enhancedSimilarity(ans, correct) // 0..1
        matchedPercentage = Math.round(sim * 10000) / 100
        if (SUBJECTIVE_SCORING === 'binary') {
          matched = sim >= SUBJECTIVE_THRESHOLD
          awarded = matched ? Number(q.marks || 1) : 0
        } else {
          // proportional
          awarded = Math.round(sim * Number(q.marks || 1) * 100) / 100
          matched = sim >= SUBJECTIVE_THRESHOLD
        }
        // if correctAnswer is empty, treat as 0
        if (!String(correct || '').trim()) { matchedPercentage = 0; awarded = 0; matched = false }
      }

      score += Number(awarded || 0)
      const detail = { questionId: qid, questionText: q.questionText || '', given: ans, correctAnswer: correct, marks: q.marks || 1, correct: matched, awardedMarks: Number(awarded || 0) }
      if (matchedPercentage !== null) detail.matchedPercentage = matchedPercentage
      // debug: include raw block (question text) when match is low or missing
      if (matchedPercentage === null || matchedPercentage < DEBUG_MATCH_THRESHOLD) {
        detail.rawBlock = q.questionText || ''
        console.debug('Low match for question', qid, { questionText: q.questionText || '', given: ans, matchedPercentage })
      }
      details.push(detail)
    }

    const percentage = totalMarks ? Math.round((score / totalMarks) * 100 * 100) / 100 : null

    // student info
    const username = req.user && req.user.username
    let studentDoc = null
    if (dbConnected) {
      studentDoc = await Student.findOne({ email: username }).lean().catch(() => null)
    }

    // try to include test title and subject for email/raw
    let testTitle = ''
    let testSubject = ''
    try {
      if (dbConnected) {
        const tdoc = await TestSeries.findById(testId).lean().catch(() => null)
        if (tdoc && tdoc.title) testTitle = tdoc.title
        if (tdoc && tdoc.subject) testSubject = tdoc.subject
      } else {
        const tdoc = inMemoryTests.find(t => String(t._id) === String(testId))
        if (tdoc) {
          testTitle = tdoc.title
          testSubject = tdoc.subject || ''
        }
      }
    } catch (e) {}

    const wasAuto = req.body && req.body.isAuto === true
    const resultPayload = {
      test: dbConnected ? testId : (testId),
      studentId: studentDoc && studentDoc._id ? studentDoc._id : undefined,
      name: studentDoc && studentDoc.name ? studentDoc.name : (req.user && req.user.name) || '',
      email: username || '',
      rollNo: studentDoc && studentDoc.rollNo ? studentDoc.rollNo : '',
      class: studentDoc && studentDoc.class ? studentDoc.class : '',
      section: studentDoc && studentDoc.section ? studentDoc.section : '',
      score,
      total: totalMarks,
      percentage,
      submittedAt: new Date(),
      raw: Object.assign({ answers: details, testTitle, subject: testSubject }, candidate ? { candidate } : {}, wasAuto ? { autoSubmitted: true } : {}),
      autoSubmitted: wasAuto === true ? true : false,
      pendingReview: hasSubjective === true ? true : false,
      status: hasSubjective === true ? 'pending' : 'final'
    }

    let created = null
    if (!dbConnected) {
      created = Object.assign({ _id: makeId('r_'), createdAt: new Date(), updatedAt: new Date() }, resultPayload)
      inMemoryTestsResults = inMemoryTestsResults || []
      inMemoryTestsResults.push(created)
    } else {
      try {
        created = await TestResult.create(resultPayload)
      } catch (createErr) {
        // handle duplicate insertion race (unique index on test+studentId or test+email)
        if (createErr && createErr.code === 11000) {
          try {
            const usernameKey = resultPayload.email || ''
            const existing = await TestResult.findOne({ test: testId, $or: [{ email: usernameKey }, { studentId: resultPayload.studentId }] }).lean().catch(() => null)
            if (existing) {
              created = existing
            } else {
              // if we cannot find, rethrow to let outer handler respond
              throw createErr
            }
          } catch (inner) { throw inner }
        } else {
          throw createErr
        }
      }
    }

    // send email to student if email present and not pending review
    try {
      if (created && created.email && !created.pendingReview) {
        const subj = `Test result: ${created.raw && created.raw.testTitle ? created.raw.testTitle : String(created.test || '')}`
        const html = `<p>Hello ${created.name || ''},</p><p>Your test has been evaluated.</p><p>Score: ${created.score} / ${created.total} (${created.percentage != null ? created.percentage + '%' : ''})</p>`
        await sendMail({ to: created.email, subject: subj, html }).catch(() => {})
      }
    } catch (mailErr) { /* ignore */ }

    return res.json({ ok: true, result: created })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Student forfeits test (e.g., leaves tab/window) — create a zero-score TestResult
app.post('/api/tests/:id/forfeit', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const testId = req.params.id
    if (!dbConnected) return res.status(503).json({ message: 'Database not available' })

    const username = req.user && req.user.username
    const studentDoc = await Student.findOne({ email: username }).lean().catch(() => null)
    // check if already submitted
    const prev = await TestResult.findOne({ test: testId, $or: [{ email: username }, { studentId: studentDoc && studentDoc._id }] }).lean().catch(() => null)
    if (prev) return res.status(403).json({ message: 'You have already submitted this test' })

    // compute total marks from questions
    const qs = await Question.find({ testId }).lean().catch(() => [])
    let totalMarks = 0
    for (const q of qs) totalMarks += Number(q.marks || 1)

    // include test subject if available
    let testSubject = ''
    try {
      const tdoc = await TestSeries.findById(testId).lean().catch(() => null)
      if (tdoc && tdoc.subject) testSubject = tdoc.subject
    } catch (e) {}

    const resultPayload = {
      test: testId,
      studentId: studentDoc && studentDoc._id ? studentDoc._id : undefined,
      name: studentDoc && studentDoc.name ? studentDoc.name : (req.user && req.user.name) || '',
      email: username || '',
      rollNo: studentDoc && studentDoc.rollNo ? studentDoc.rollNo : '',
      class: studentDoc && studentDoc.class ? studentDoc.class : '',
      section: studentDoc && studentDoc.section ? studentDoc.section : '',
      score: 0,
      total: totalMarks || null,
      percentage: totalMarks ? 0 : null,
      submittedAt: new Date(),
      raw: { forfeited: true, subject: testSubject }
    }

    const created = await TestResult.create(resultPayload)
    return res.json({ ok: true, result: created })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Upload bulk results as CSV and import into TestResult docs (admin/faculty)
app.post('/api/tests/:id/results/upload', verifyToken, requireRole(['admin','faculty']), upload.single('file'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const testId = req.params.id
    const file = req.file
    if (!file) return res.status(400).json({ message: 'CSV file required' })
    const fp = path.join(uploadsDir, file.filename)
    const content = fs.readFileSync(fp, 'utf8')
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (!lines.length) return res.status(400).json({ message: 'CSV file is empty' })
    const header = lines[0].split(',').map(h => h.trim())
    // attempt to fetch test subject and attach it to each imported row
    let testSubject = ''
    try { const tdoc = await TestSeries.findById(testId).lean().catch(() => null); if (tdoc && tdoc.subject) testSubject = tdoc.subject } catch (e) {}
    const results = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',')
      const obj = {}
      for (let j = 0; j < header.length; j++) {
        obj[header[j]] = cols[j] !== undefined ? cols[j].trim() : ''
      }
      const score = obj.score ? Number(obj.score) : (obj.marks ? Number(obj.marks) : null)
      const total = obj.total ? Number(obj.total) : null
      const percentage = obj.percentage ? Number(obj.percentage) : (score !== null && total ? Math.round((score / total) * 100 * 100) / 100 : null)
      const submittedAt = obj.submittedAt ? new Date(obj.submittedAt) : new Date()
      const r = {
        test: testId,
        name: obj.name || obj.student || obj.fullName || '',
        email: obj.email || '',
        rollNo: obj.rollNo || obj.roll || obj.roll_no || '',
        class: obj.class || obj.Class || '',
        section: obj.section || '',
        score: score,
        total: total,
        percentage: percentage,
        submittedAt: submittedAt,
        raw: obj
      }
      // ensure raw.subject contains the test's subject (prefer CSV value if provided)
      try { r.raw = r.raw || {}; if (!r.raw.subject) r.raw.subject = testSubject } catch (e) {}
      results.push(r)
    }
    // insert many
    const inserted = await TestResult.insertMany(results)
    return res.json(inserted)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Parent/Admin: get test results for a specific student
app.get('/api/tests/results/by-student/:id', verifyToken, requireRole(['parent','admin']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const studentId = req.params.id
    if (!studentId) return res.status(400).json({ message: 'student id required' })
    const items = await TestResult.find({ $or: [{ studentId }, { studentId: new mongoose.Types.ObjectId(studentId) }] }).sort({ submittedAt: -1 }).lean()
    return res.json(items)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Student: submit an assignment answer (file optional)
app.post('/api/assignments/:id/submit', verifyToken, upload.single('file'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const assignment = await Assignment.findById(req.params.id).lean()
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' })
    // check due date
    if (assignment.dueDate && new Date() > new Date(assignment.dueDate)) return res.status(400).json({ message: 'Submission closed — due date passed' })
    const answerText = req.body.answerText || ''
    const student = await Student.findOne({ email: req.user.username }).lean().catch(() => null)
    const submission = await Submission.create({
      assignmentId: assignment._id,
      studentId: student ? student._id : null,
      studentName: student ? student.name : (req.user.name || ''),
      studentEmail: req.user.username || '',
      studentRoll: student ? (student.rollNo || '') : '',
      studentClass: student ? (student.class || '') : '',
      answerText,
      filePath: req.file ? `/uploads/${req.file.filename}` : ''
    })
    // notify faculty via SSE
    try { sendSseEvent('assignment_submitted', { assignmentId: assignment._id, submissionId: submission._id, studentEmail: submission.studentEmail }) } catch (e) {}
    return res.status(201).json(submission)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Leaves: student apply for leave
app.post('/api/leaves', verifyToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { from, to, reason } = req.body || {}
    if (!from || !to) return res.status(400).json({ message: 'from and to required' })

    // try to enrich with student or faculty record if available
    let student = null
    let faculty = null
    try { student = await Student.findOne({ email: req.user.username }).lean().catch(() => null) } catch (e) { student = null }
    try { faculty = await Faculty.findOne({ email: req.user.username }).lean().catch(() => null) } catch (e) { faculty = null }

    const leaveData = {
      userId: req.user.sub || null,
      username: req.user.name || req.user.username || req.user.sub,
      email: (student && student.email) || (faculty && faculty.email) || req.user.username || '',
      class: (student && student.class) || '',
      section: (student && student.section) || '',
      rollNo: (student && (student.rollNo || student.roll)) || '',
      department: (faculty && faculty.department) || (faculty && faculty.subject) || '',
      role: req.user.role || 'student',
      from: new Date(from),
      to: new Date(to),
      reason: reason || '',
      status: 'Pending'
    }

    const doc = await Leave.create(leaveData)
    // notify admin UIs via SSE
    try { sendSseEvent('leave_created', { id: doc._id, email: doc.email, username: doc.username }) } catch (e) {}
    return res.status(201).json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Get leaves: admins see all, others see their own
app.get('/api/leaves', verifyToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    if (req.user && req.user.role === 'admin') {
      // allow admin to filter by role (student/faculty) using query param
      const q = {}
      if (req.query && req.query.role) q.role = req.query.role
      const items = await Leave.find(q).sort({ createdAt: -1 }).lean()
      return res.json(items)
    }
    // Faculty may request student leaves for their assigned classes via ?role=student
    if (req.user && req.user.role === 'faculty' && req.query && req.query.role === 'student') {
      // resolve faculty record
      const u = await User.findById(req.user.sub).lean().catch(() => null)
      if (!u) return res.status(403).json({ message: 'Unauthorized' })
      let fac = await Faculty.findOne({ email: u.username }).lean().catch(() => null)
      if (!fac && u.name) fac = await Faculty.findOne({ name: u.name }).lean().catch(() => null)
      if (!fac && u.contact) fac = await Faculty.findOne({ contact: u.contact }).lean().catch(() => null)
      if (!fac) return res.status(403).json({ message: 'Faculty record not linked' })
      const q = { role: 'student' }
      // build class/section restrictions
      const orClauses = []
      for (const a of fac.assignments || []) {
        if (!a.class) continue
        if (a.isClassTeacher) {
          // match class (any section)
          orClauses.push({ class: String(a.class) })
        } else if (a.section) {
          orClauses.push({ class: String(a.class), section: String(a.section) })
        }
      }
      if (orClauses.length === 0) return res.json([])
      q.$or = orClauses
      const items = await Leave.find(q).sort({ createdAt: -1 }).lean()
      return res.json(items)
    }
    // non-admins: list only own leaves
    const mine = await Leave.find({ userId: req.user.sub }).sort({ createdAt: -1 }).lean()
    return res.json(mine)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Get my leaves (explicit)
app.get('/api/leaves/my', verifyToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const mine = await Leave.find({ userId: req.user.sub }).sort({ createdAt: -1 }).lean()
    return res.json(mine)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Update leave status (admin only) - accept optional note
app.put('/api/leaves/:id/status', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { status, note } = req.body || {}
    if (!status) return res.status(400).json({ message: 'status required' })
    const id = req.params.id
    const l = await Leave.findById(id)
    if (!l) return res.status(404).json({ message: 'Leave not found' })

    l.status = status
    l.reviewedBy = req.user.name || req.user.username || req.user.sub
    l.reviewedAt = new Date()
    l.reviewNote = note || ''
    await l.save()

    // attempt to send email notification to student
    try {
      const to = l.email || l.username || ''
      if (to) {
        const subject = `Your leave request has been ${status}`
        const text = `Hello ${l.username || ''},\n\nYour leave request from ${l.from ? new Date(l.from).toLocaleDateString() : ''} to ${l.to ? new Date(l.to).toLocaleDateString() : ''} has been ${status}.\n\nNote from admin: ${l.reviewNote || 'No note provided.'}\n\nRegards, Admin`
        if (status === 'Approved') {
          await notifyEvent({ event: 'leave_approved', phone: l.contact, message: text, emailOpts: { to, subject, text } }).catch(() => {})
        } else {
          await sendMail({ to, subject, text }).catch(() => {})
        }
      }
    } catch (mailErr) {
      console.warn('Failed to notify student about leave status change:', mailErr && (mailErr.message || String(mailErr)))
    }

    try { sendSseEvent('leave_updated', { id: l._id, status: l.status, email: l.email }) } catch (e) {}
    return res.json(l)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: upload syllabus for a class/section
app.post('/api/syllabus', verifyToken, requireRole('admin'), upload.single('file'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { class: cls, section = 'ALL', subject } = req.body || {}
    if (!cls) return res.status(400).json({ message: 'class required' })
    const file = req.file
    const filePath = file ? `/uploads/${file.filename}` : ''
    const doc = await Syllabus.create({ class: String(cls), section: section || 'ALL', subject: subject || '', name: file ? file.originalname : '', mime: file ? file.mimetype : '', filePath, uploadedBy: req.user && req.user.sub })
    return res.status(201).json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: create a notice (target one or more roles)
// Admin: create a notice (target one or more roles) - supports optional PDF upload and student filters
app.post('/api/notices', verifyToken, requireRole('admin'), upload.single('file'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { title, body, targets } = req.body || {}
    if (!title) return res.status(400).json({ message: 'title required' })
    const t = Array.isArray(targets) ? targets : (typeof targets === 'string' ? targets.split(',').map(s => s.trim()) : ['all'])
    const file = req.file
    const filePath = file ? `/uploads/${file.filename}` : ''
    const fileName = file ? file.originalname : ''
    const fileMime = file ? file.mimetype : ''

    // student targeting
    const studentAll = req.body.studentAll === undefined ? true : (String(req.body.studentAll) === 'true' || req.body.studentAll === '1')
    const studentClass = req.body.studentClass || ''
    const studentSection = req.body.studentSection || ''

    const doc = await Notice.create({
      title,
      body: body || '',
      targets: t.length ? t : ['all'],
      createdBy: req.user && req.user.sub,
      createdByName: req.user && (req.user.name || req.user.username),
      filePath,
      fileName,
      fileMime,
      studentAll,
      studentClass: studentClass || undefined,
      studentSection: studentSection || undefined
    })
    try { sendSseEvent('notice_created', { id: doc._id, targets: doc.targets }) } catch (e) {}
    
    // Async notification logic
    (async () => {
      try {
        let phoneTargets = [];
        if (doc.targets.includes('all') || doc.targets.includes('student')) {
          let q = {}
          if (!doc.studentAll) {
            if (doc.studentClass) q.class = doc.studentClass;
            if (doc.studentSection) q.section = doc.studentSection;
          }
          const studs = await Student.find(q).lean();
          studs.forEach(s => s.contact && phoneTargets.push({ phone: s.contact, email: s.email }));
        }
        if (doc.targets.includes('all') || doc.targets.includes('faculty')) {
          const facs = await Faculty.find().lean();
          facs.forEach(f => f.contact && phoneTargets.push({ phone: f.contact, email: f.email }));
        }
        for (const t of phoneTargets) {
          await notifyEvent({
            event: 'new_notice',
            phone: t.phone,
            message: `New Notice: ${doc.title}. Please check the ERP portal.`,
            emailOpts: { to: t.email, subject: `Notice: ${doc.title}`, text: `New Notice: ${doc.title}\n\n${doc.body}` }
          }).catch(()=>{})
        }
      } catch (e) {
        console.warn('Failed to notify for new notice', e.message);
      }
    })();
    
    return res.status(201).json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Get notices: admin can optionally filter by role via ?role=student|faculty|parent
app.get('/api/notices', verifyToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    // Admin can list all or filter by role
    if (req.user && req.user.role === 'admin') {
      const q = {}
      if (req.query && req.query.role) q.targets = req.query.role
      const items = await Notice.find(q).sort({ createdAt: -1 }).lean()
      return res.json(items)
    }
    // Non-admins: return notices targeted to their role or 'all'
    const role = req.user && req.user.role
    const items = await Notice.find({ $or: [ { targets: 'all' }, { targets: role } ] }).sort({ createdAt: -1 }).lean()
    return res.json(items)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Public: get syllabus for a class and section (match specific section or ALL)
app.get('/api/syllabus', async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const cls = req.query.class || req.query.cls || null
    const section = req.query.section || req.query.sec || null
    // If no class provided, return all syllabus entries (legacy callers expect this)
    if (!cls) {
      const items = await Syllabus.find().sort({ uploadedAt: -1 }).lean()
      return res.json(items)
    }
    // prefer exact section, but include ALL as fallback; return most recent
    const q = { class: String(cls) }
    if (section) q.$or = [{ section }, { section: 'ALL' }]
    const items = await Syllabus.find(q).sort({ uploadedAt: -1 }).lean()
    return res.json(items)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: delete a syllabus entry (and its uploaded file)
app.delete('/api/syllabus/:id', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const id = req.params.id
    if (!id) return res.status(400).json({ message: 'id required' })
    const doc = await Syllabus.findById(id)
    if (!doc) return res.status(404).json({ message: 'Syllabus not found' })
    // try to remove uploaded file if exists
    try {
      if (doc.filePath) {
        const fp = path.join(__dirname, doc.filePath.replace(/^\//, ''))
        if (fs.existsSync(fp)) {
          fs.unlinkSync(fp)
        }
      }
    } catch (e) {
      console.warn('Failed to unlink syllabus file', doc.filePath, e && e.message)
    }
    await Syllabus.deleteOne({ _id: id })
    return res.json({ ok: true })
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Faculty: upload a resource (PDF) for students
// Allow faculty and admin to upload resources (admin can upload forms)
app.post('/api/resources', verifyToken, requireRole(['faculty','admin']), upload.single('file'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { title, subject } = req.body || {}
    const klass = req.body.class || req.body.klass || req.body.cls || ''
    if (!title) return res.status(400).json({ message: 'title required' })
    const file = req.file
    if (!file) return res.status(400).json({ message: 'file required' })
    const filePath = `/uploads/${file.filename}`
    const doc = await Resource.create({ title: title || file.originalname, subject: subject || '', class: String(klass || ''), filename: file.filename, originalname: file.originalname, uploadedBy: req.user && req.user.sub })
    return res.status(201).json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Authenticated: list resources (students and faculty)
app.get('/api/resources', verifyToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const q = {}
    if (req.query.class || req.query.cls) q.class = String(req.query.class || req.query.cls)
    if (req.query.subject) q.subject = req.query.subject
    const items = await Resource.find(q).sort({ createdAt: -1 }).lean()
    // attach accessible file URL
    const host = ''
    const mapped = items.map(it => ({ ...it, url: `/uploads/${it.filename}` }))
    return res.json(mapped)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Faculty/Admin: delete a resource. Faculty can delete only their own uploads.
app.delete('/api/resources/:id', verifyToken, requireRole(['faculty','admin']), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const id = req.params && req.params.id
    if (!id) return res.status(400).json({ message: 'id required' })

    const item = await Resource.findById(id).catch(() => null)
    if (!item) return res.status(404).json({ message: 'Resource not found' })

    const isAdmin = req.user && req.user.role === 'admin'
    const isOwner = item.uploadedBy && req.user && String(item.uploadedBy) === String(req.user.sub)
    if (!isAdmin && !isOwner) return res.status(403).json({ message: 'You can delete only your own resources' })

    try {
      if (item.filename) {
        const filePath = path.join(uploadsDir, String(item.filename))
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      }
    } catch (fileErr) {
      console.warn('Failed to delete resource file', fileErr && fileErr.message)
    }

    await item.deleteOne()
    return res.json({ ok: true })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Public: list uploaded forms/resources for download (used on Start page)
app.get('/api/forms', async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const Resource = require('./models/Resource')
    const CustomForm = require('./models/CustomForm')
    const items = await Resource.find().sort({ createdAt: -1 }).lean().catch(() => [])
    const customForms = await CustomForm.find({ status: 'active' }).sort({ createdAt: -1 }).lean().catch(() => [])
    const mappedResources = (items || []).map(it => ({ _id: it._id, kind: 'resource', title: it.title || it.originalname || it.filename, filename: it.filename, url: `/uploads/${it.filename}`, createdAt: it.createdAt }))
    const mappedCustom = (customForms || []).map(form => ({
      _id: form._id,
      kind: 'custom',
      title: form.title,
      category: form.category,
      description: form.description,
      fields: form.fields || [],
      createdAt: form.createdAt
    }))
    return res.json([...mappedCustom, ...mappedResources])
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: custom form builder
app.get('/api/admin/custom-forms', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const CustomForm = require('./models/CustomForm')
    const items = await CustomForm.find().sort({ createdAt: -1 }).lean().catch(() => [])
    return res.json(items)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.post('/api/admin/custom-forms', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const CustomForm = require('./models/CustomForm')
    const { title, category = 'General', description = '', status = 'active', fields = [] } = req.body || {}
    if (!title) return res.status(400).json({ message: 'title required' })
    if (!Array.isArray(fields) || fields.length === 0) return res.status(400).json({ message: 'at least one field required' })
    const cleanFields = fields
      .filter(field => field && String(field.label || '').trim())
      .map(field => ({
        label: String(field.label || '').trim(),
        type: String(field.type || 'text'),
        required: !!field.required,
        placeholder: String(field.placeholder || ''),
        options: Array.isArray(field.options) ? field.options.map(opt => String(opt).trim()).filter(Boolean) : []
      }))
    const doc = await CustomForm.create({ title: String(title), category: String(category || 'General'), description: String(description || ''), status: String(status || 'active'), fields: cleanFields, createdBy: req.user && req.user.sub })
    return res.status(201).json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.put('/api/admin/custom-forms/:id', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const CustomForm = require('./models/CustomForm')
    const { title, category = 'General', description = '', status = 'active', fields = [] } = req.body || {}
    if (!title) return res.status(400).json({ message: 'title required' })
    if (!Array.isArray(fields) || fields.length === 0) return res.status(400).json({ message: 'at least one field required' })
    const cleanFields = fields
      .filter(field => field && String(field.label || '').trim())
      .map(field => ({
        _id: field._id,
        label: String(field.label || '').trim(),
        type: String(field.type || 'text'),
        required: !!field.required,
        placeholder: String(field.placeholder || ''),
        options: Array.isArray(field.options) ? field.options.map(opt => String(opt).trim()).filter(Boolean) : []
      }))
    const doc = await CustomForm.findByIdAndUpdate(req.params.id, { title: String(title), category: String(category || 'General'), description: String(description || ''), status: String(status || 'active'), fields: cleanFields }, { new: true }).lean()
    if (!doc) return res.status(404).json({ message: 'Form not found' })
    return res.json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.delete('/api/admin/custom-forms/:id', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const CustomForm = require('./models/CustomForm')
    const doc = await CustomForm.findByIdAndDelete(req.params.id).lean()
    if (!doc) return res.status(404).json({ message: 'Form not found' })
    return res.json({ ok: true })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Public: submit a form query for a given uploaded form (optional attachment)
app.post('/api/form-query', upload.single('attachment'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const FormQuery = require('./models/FormQuery')
    const { formId, formTitle, name, email, contact, description } = req.body || {}
    if (!name || !email) return res.status(400).json({ message: 'name and email required' })

    const doc = await FormQuery.create({
      formId: formId || undefined,
      formTitle: formTitle || '',
      name: String(name),
      email: String(email),
      contact: contact ? String(contact) : '',
      description: description ? String(description) : '',
      filename: req.file ? req.file.filename : undefined,
      originalname: req.file ? req.file.originalname : undefined,
    })
    return res.status(201).json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Public: submit a built custom form
app.post('/api/custom-form-query', upload.any(), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const FormQuery = require('./models/FormQuery')
    const CustomForm = require('./models/CustomForm')
    const { formId, responses } = req.body || {}
    if (!formId) return res.status(400).json({ message: 'formId required' })
    const form = await CustomForm.findById(formId).lean().catch(() => null)
    if (!form || form.status !== 'active') return res.status(404).json({ message: 'Form not available' })
    let parsedResponses = {}
    try { parsedResponses = responses ? JSON.parse(responses) : {} } catch (e) { parsedResponses = {} }

    for (const field of form.fields || []) {
      if (!field.required) continue
      const value = parsedResponses[String(field._id)]
      const hasValue = Array.isArray(value) ? value.length > 0 : String(value || '').trim() !== ''
      if (!hasValue && field.type !== 'file') return res.status(400).json({ message: `${field.label} is required` })
    }

    const fileFields = (req.files || []).map(file => {
      const fieldId = String(file.fieldname || '').replace(/^file_/, '')
      const field = (form.fields || []).find(item => String(item._id) === fieldId) || {}
      return { fieldId, fieldLabel: field.label || 'Attachment', filename: file.filename, originalname: file.originalname }
    })
    const labeledResponses = {}
    ;(form.fields || []).forEach(field => {
      if (field.type === 'file') return
      const key = String(field._id)
      if (parsedResponses[key] !== undefined) labeledResponses[field.label || key] = parsedResponses[key]
    })
    const firstEmailField = (form.fields || []).find(field => field.type === 'email')
    const firstPhoneField = (form.fields || []).find(field => field.type === 'phone')
    const firstNameField = (form.fields || []).find(field => /name/i.test(String(field.label || '')))
    const doc = await FormQuery.create({
      formId,
      formTitle: form.title,
      formType: 'custom',
      name: firstNameField ? String(parsedResponses[String(firstNameField._id)] || 'Form submission') : 'Form submission',
      email: firstEmailField ? String(parsedResponses[String(firstEmailField._id)] || 'no-email@example.com') : 'no-email@example.com',
      contact: firstPhoneField ? String(parsedResponses[String(firstPhoneField._id)] || '') : '',
      description: form.description || '',
      responses: labeledResponses,
      attachments: fileFields,
      filename: fileFields[0] && fileFields[0].filename,
      originalname: fileFields[0] && fileFields[0].originalname,
    })
    return res.status(201).json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Public: submit a contact query (from Start page contact button)
app.post('/api/contact-query', upload.single('attachment'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const ContactQuery = require('./models/ContactQuery')
    const { name, email, contact, description } = req.body || {}
    if (!name || !email) return res.status(400).json({ message: 'name and email required' })

    const doc = await ContactQuery.create({
      name: String(name),
      email: String(email),
      contact: contact ? String(contact) : '',
      description: description ? String(description) : '',
      filename: req.file ? req.file.filename : undefined,
      originalname: req.file ? req.file.originalname : undefined,
    })

    // Try to notify admin email about new contact (best-effort)
    try {
      const adminEmail = process.env.FROM_EMAIL || process.env.SMTP_USER
      if (adminEmail) {
        await sendMail({
          to: adminEmail,
          subject: `New contact query from ${doc.name}`,
          html: `<p><strong>Name:</strong> ${doc.name}</p><p><strong>Email:</strong> ${doc.email}</p><p><strong>Contact:</strong> ${doc.contact || '-'} </p><p><strong>Description:</strong><br/>${(doc.description || '').replace(/\n/g, '<br/>')}</p>`
        }).catch(() => null)
      }
    } catch (e) { /* ignore notification errors */ }

    return res.status(201).json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: list submitted contact queries
app.get('/api/admin/contact-queries', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const ContactQuery = require('./models/ContactQuery')
    const items = await ContactQuery.find().sort({ createdAt: -1 }).lean().catch(() => [])
    const mapped = (items || []).map(it => ({ ...it, url: it.filename ? `/uploads/${it.filename}` : undefined }))
    return res.json(mapped)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: update status of a contact query and optionally notify
app.patch('/api/admin/contact-queries/:id/status', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const ContactQuery = require('./models/ContactQuery')
    const id = req.params && req.params.id
    const { status, notify = false, note = '' } = req.body || {}
    if (!id) return res.status(400).json({ message: 'id required' })
    const doc = await ContactQuery.findById(id).catch(() => null)
    if (!doc) return res.status(404).json({ message: 'Not found' })
    if (status) doc.status = String(status)
    await doc.save()

    // Send email to user if requested
    if (notify && doc.email) {
      try {
        const body = `<p>Your contact query status has been updated to <strong>${doc.status}</strong>.</p><p>${note ? `<strong>Note:</strong><br/>${String(note).replace(/\n/g,'<br/>')}` : ''}</p>`
        await sendMail({ to: doc.email, subject: `Your contact query status: ${doc.status}`, html: body }).catch(() => null)
        doc.notified = true
        await doc.save().catch(() => null)
      } catch (e) { /* ignore mail errors */ }
    }

    return res.json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: list submitted form queries
app.get('/api/admin/form-queries', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const FormQuery = require('./models/FormQuery')
    const items = await FormQuery.find().sort({ createdAt: -1 }).lean().catch(() => [])
    const mapped = (items || []).map(it => ({ ...it, url: it.filename ? `/uploads/${it.filename}` : undefined }))
    return res.json(mapped)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: compute student rank analytics by class/section
app.get('/api/admin/analytics/student-rank', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const TestResult = require('./models/TestResult')
    const ReportCard = require('./models/ReportCard')
    const Student = require('./models/Student')

    // filters: class, section, source (testResults|reportCards|both), from, to, limit
    const cls = req.query.class ? String(req.query.class) : null
    const section = req.query.section ? String(req.query.section) : null
    const source = req.query.source || 'both'
    const from = req.query.from ? new Date(req.query.from) : null
    const to = req.query.to ? new Date(req.query.to) : null
    const limit = Math.min(Number(req.query.limit) || 2000, 2000)

    // We'll build a map of student identifier -> aggregated data
    const map = new Map()

    // Helper to push test result into map
    function pushTestResult(key, r) {
      const entry = map.get(key) || { name: r.name || '', studentId: r.studentId || null, class: r.class || '', section: r.section || '', scores: [], hasReportCard: false, reportPercentage: undefined, email: r.email || '', rollNumber: r.rollNo || '' }
      entry.name = entry.name || r.name || ''
      entry.class = entry.class || r.class || ''
      entry.section = entry.section || r.section || ''
      entry.email = entry.email || r.email || ''
      entry.rollNumber = entry.rollNumber || r.rollNo || ''
      if (typeof r.percentage === 'number' && !isNaN(r.percentage)) entry.scores.push(Number(r.percentage))
      else if (typeof r.score === 'number' && typeof r.total === 'number' && r.total > 0) entry.scores.push((Number(r.score) / Number(r.total)) * 100)
      map.set(key, entry)
    }

    // Helper to push report card into map (prefer report card percentage)
    function pushReportCard(key, c) {
      const entry = map.get(key) || { name: c.recipientName || '', studentId: c.recipientId || null, class: c.className || '', section: c.section || '', scores: [], hasReportCard: false, reportPercentage: undefined, email: c.recipientEmail || '', rollNumber: c.rollNumber || '' }
      entry.name = entry.name || c.recipientName || ''
      entry.class = entry.class || c.className || ''
      entry.section = entry.section || c.section || ''
      entry.email = entry.email || c.recipientEmail || ''
      entry.rollNumber = entry.rollNumber || c.rollNumber || ''
      if (typeof c.percentage === 'number' && !isNaN(c.percentage)) {
        entry.reportPercentage = Number(c.percentage)
        entry.hasReportCard = true
      }
      map.set(key, entry)
    }

    // Fetch test results if requested
    if (source === 'testResults' || source === 'both') {
      const q = {}
      if (cls) q.class = cls
      if (section) q.section = section
      if (from || to) q.submittedAt = {}
      if (from) q.submittedAt.$gte = from
      if (to) q.submittedAt.$lte = to

      const results = await TestResult.find(q).lean().catch(() => [])
      for (const r of (results || [])) {
        const key = r.studentId ? String(r.studentId) : `${r.email || r.name || ''}::${r.class || ''}::${r.section || ''}`
        pushTestResult(key, r)
      }
    }

    // Fetch report cards if requested
    if (source === 'reportCards' || source === 'both') {
      const q = {}
      if (cls) q.className = cls
      if (section) q.section = section
      if (from || to) q.createdAt = {}
      if (from) q.createdAt.$gte = from
      if (to) q.createdAt.$lte = to

      const cards = await ReportCard.find(q).lean().catch(() => [])
      for (const c of (cards || [])) {
        const key = c.recipientId ? String(c.recipientId) : `${c.recipientEmail || c.recipientName || ''}::${c.className || ''}::${c.section || ''}`
        pushReportCard(key, c)
      }
    }

    // Convert map to array and compute aggregate score (prefer report card percentage when present)
    const rows = []
    for (const [key, v] of map.entries()) {
      // If a report card percentage is present, use it as the basis
      if (v.hasReportCard && typeof v.reportPercentage === 'number' && !isNaN(v.reportPercentage)) {
        rows.push({ key, name: v.name || '', studentId: v.studentId || null, class: v.class || '', section: v.section || '', avg: Number(v.reportPercentage.toFixed(2)), count: 1, email: v.email || '', rollNumber: v.rollNumber || '' })
        continue
      }

      const scores = (v.scores || []).filter(s => typeof s === 'number' && !isNaN(s))
      if (scores.length === 0) continue
      const avg = scores.reduce((a,b) => a + b, 0) / scores.length
      rows.push({ key, name: v.name || '', studentId: v.studentId || null, class: v.class || '', section: v.section || '', avg: Number(avg.toFixed(2)), count: scores.length, email: v.email || '', rollNumber: v.rollNumber || '' })
    }

    // Ensure every student matching the filters is present in the rows.
    // Students without test/report data will have `count: 0` and `avg: null` and will sort after students with tests.
    try {
      const sq = {}
      if (cls) sq.class = cls
      if (section) sq.section = section
      const students = await Student.find(sq).lean().catch(() => [])
      for (const s of (students || [])) {
        const skey = s._id ? String(s._id) : `${s.email || s.name || ''}::${s.class || ''}::${s.section || ''}`
        const exists = rows.some(r => r.key === skey)
        if (!exists) {
          rows.push({ key: skey, name: s.name || '', studentId: s._id || null, class: s.class || '', section: s.section || '', avg: null, count: 0, email: s.email || '', rollNumber: s.rollNo || '' })
        }
      }
    } catch (e) {
      // ignore student lookup failure and continue with existing rows
    }

    // Sort by class, then section, then count desc (more tests first), then avg desc, then name asc
    rows.sort((a,b) => {
      if ((a.class || '') < (b.class || '')) return -1
      if ((a.class || '') > (b.class || '')) return 1
      if ((a.section || '') < (b.section || '')) return -1
      if ((a.section || '') > (b.section || '')) return 1
      // prefer higher count (more tests) first
      const ca = Number(a.count || 0), cb = Number(b.count || 0)
      if (ca !== cb) return cb - ca
      // then higher average
      const aa = (typeof a.avg === 'number') ? a.avg : -Infinity
      const ab = (typeof b.avg === 'number') ? b.avg : -Infinity
      if (aa !== ab) return ab - aa
      // finally by name
      if ((a.name || '') < (b.name || '')) return -1
      if ((a.name || '') > (b.name || '')) return 1
      return 0
    })

    // Add rank within each class-section
    const ranked = []
    let currentClass = null, currentSection = null, rank = 0
    for (const r of rows) {
      if (r.class !== currentClass || r.section !== currentSection) { currentClass = r.class; currentSection = r.section; rank = 1 }
      else rank++
      ranked.push({ ...r, rank })
      if (ranked.length >= limit) break
    }

    return res.json(ranked)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

  // Gallery endpoints: Admin can create gallery entries (label + multiple images). Public can list.
  try {
    const Gallery = require('./models/Gallery')

    // Create gallery item (admin only)
    app.post('/api/gallery', verifyToken, requireRole('admin'), upload.array('images', 100), async (req, res) => {
      if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
      try {
        const label = (req.body && req.body.label) ? String(req.body.label) : ''
        if (!label) return res.status(400).json({ message: 'label required' })
        const files = req.files || []
        const images = (files || []).map(f => ({ filename: f.filename, originalname: f.originalname, url: `/uploads/${f.filename}` }))
        const doc = await Gallery.create({ label, images, createdBy: req.user && req.user.sub })
        return res.status(201).json(doc)
      } catch (e) { return res.status(500).json({ message: e.message }) }
    })

    // List gallery items (public)
    app.get('/api/gallery', async (req, res) => {
      if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
      try {
        const items = await Gallery.find({}).sort({ createdAt: -1 }).lean().catch(() => [])
        const mapped = (items || []).map(it => ({ ...it, images: (it.images || []).map(img => ({ ...img, url: img.url || `/uploads/${img.filename}` })) }))
        return res.json(mapped)
      } catch (e) { return res.status(500).json({ message: e.message }) }
    })

    // Delete a gallery item (admin)
    app.delete('/api/gallery/:id', verifyToken, requireRole('admin'), async (req, res) => {
      if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
      try {
        const id = req.params && req.params.id
        if (!id) return res.status(400).json({ message: 'id required' })
        const g = await Gallery.findById(id).catch(() => null)
        if (!g) return res.status(404).json({ message: 'Gallery item not found' })
        // attempt to unlink files
        try {
          for (const im of (g.images || [])) {
            if (im && im.filename) {
              const p = path.join(uploadsDir, String(im.filename))
              fs.unlinkSync(p)
            }
          }
        } catch (e) { console.warn('Failed to unlink gallery files', e && e.message) }
        await Gallery.deleteOne({ _id: id }).catch(() => null)
        return res.json({ ok: true })
      } catch (e) { return res.status(500).json({ message: e.message }) }
    })
  } catch (e) { console.warn('Failed to register gallery routes', e && e.message) }

// Faculty: list resources uploaded by the current faculty member
app.get('/api/resources/my', verifyToken, requireRole('faculty'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const uploader = req.user && req.user.sub
    if (!uploader) return res.status(400).json({ message: 'uploader id missing' })
    const items = await Resource.find({ uploadedBy: uploader }).sort({ createdAt: -1 }).lean()
    const mapped = items.map(it => ({ ...it, url: `/uploads/${it.filename}` }))
    return res.json(mapped)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// (timetable endpoints implemented later — keep single richer implementation)

// Admin helper: regenerate PDFs for timetables that have `content` but no `filePath`.
// Useful after installing pdfkit if earlier saves didn't create PDFs.
app.post('/api/timetable/regenerate-pdfs', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const items = await Timetable.find({ content: { $exists: true, $ne: null }, $or: [{ filePath: { $exists: false } }, { filePath: null }, { filePath: '' }] }).lean()
    if (!items || items.length === 0) return res.json({ regenerated: 0, message: 'No timetables need regeneration' })

    // pdfkit require consolidated at top of file
    const results = []
    for (const t of items) {
      try {
        const content = typeof t.content === 'string' ? JSON.parse(t.content) : t.content
        const filename = `${Date.now()}_${String(t.class || 'cls')}_${String(t.section || 'ALL')}_timetable.pdf`.replace(/\s+/g, '_')
        const outPath = path.join(uploadsDir, filename)
        const pdfDoc = new PDFDocument({ margin: 30, size: 'A4' })
        const stream = fs.createWriteStream(outPath)
        pdfDoc.pipe(stream)

        pdfDoc.fontSize(18).text(String(t.name || 'Timetable'), { align: 'center' })
        pdfDoc.moveDown()

        if (content && typeof content === 'object') {
          const days = Object.keys(content)
          const periodOrder = []
          const seen = new Set()
          for (const d of days) {
            const row = content[d] || {}
            for (const p of Object.keys(row)) {
              if (!seen.has(p)) { seen.add(p); periodOrder.push(p) }
            }
          }

          // Table layout
          const left = pdfDoc.page.margins.left
          const pageWidth = pdfDoc.page.width - pdfDoc.page.margins.left - pdfDoc.page.margins.right
          const dayCol = Math.max(80, Math.floor(pageWidth * 0.18))
          const remaining = Math.max(0, pageWidth - dayCol)
          const colWidth = periodOrder.length ? Math.floor(remaining / periodOrder.length) : remaining
          const headerH = 26
          const rowH = 22

          let xStart = left
          let y = pdfDoc.y

          // draw header cells
          pdfDoc.font('Helvetica-Bold').fontSize(12)
          pdfDoc.fillColor('#111827')
          // Day header
          pdfDoc.rect(xStart, y, dayCol, headerH).fill('#f3f4f6')
          pdfDoc.fillColor('#0f172a').text('Day', xStart + 6, y + 6, { width: dayCol - 12, align: 'left' })
          xStart += dayCol
          // Period headers
          for (const p of periodOrder) {
            pdfDoc.fillColor('#111827')
            pdfDoc.rect(xStart, y, colWidth, headerH).fill('#f3f4f6')
            pdfDoc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text(p, xStart + 4, y + 6, { width: colWidth - 8, align: 'center' })
            xStart += colWidth
          }

          // draw rows
          pdfDoc.font('Helvetica').fontSize(10)
          y += headerH
          for (const d of days) {
            xStart = left
            // Day cell
            pdfDoc.fillColor('#ffffff').rect(xStart, y, dayCol, rowH).fill()
            pdfDoc.fillColor('#0b1220').text(String(d), xStart + 6, y + 6, { width: dayCol - 12, align: 'left' })
            xStart += dayCol
            // Period cells
            for (const p of periodOrder) {
              pdfDoc.fillColor('#ffffff').rect(xStart, y, colWidth, rowH).fill()
              const txt = String((content[d] && content[d][p]) || '')
              pdfDoc.fillColor('#0b1220').text(txt, xStart + 4, y + 6, { width: colWidth - 8, align: 'center' })
              xStart += colWidth
            }

            // draw borders for this row (simple lines)
            pdfDoc.strokeColor('#e5e7eb').lineWidth(0.5)
            let vx = left
            pdfDoc.moveTo(vx, y).lineTo(vx + dayCol + colWidth * periodOrder.length, y).stroke()
            for (let i = 0; i <= periodOrder.length; i++) {
              pdfDoc.moveTo(vx, y).lineTo(vx, y + rowH).stroke()
              vx += (i === 0 ? dayCol : colWidth)
            }
            pdfDoc.moveTo(left, y + rowH).lineTo(left + dayCol + colWidth * periodOrder.length, y + rowH).stroke()

            y += rowH
            // check page break
            if (y + rowH + 60 > pdfDoc.page.height - pdfDoc.page.margins.bottom) {
              pdfDoc.addPage()
              y = pdfDoc.page.margins.top
            }
          }
          // move cursor after table
          pdfDoc.moveDown()
        } else {
          pdfDoc.fontSize(12).text(String(t.content))
        }

        pdfDoc.end()
        await new Promise((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject) })

        const fileP = `/uploads/${filename}`
        await Timetable.findByIdAndUpdate(t._id, { filePath: fileP, mime: 'application/pdf' })
        results.push({ id: t._id, filePath: fileP })
      } catch (errT) {
        console.warn('Failed to regenerate PDF for timetable', t._id, errT && (errT.message || String(errT)))
      }
    }

    return res.json({ regenerated: results.length, items: results })
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Regenerate PDF for a single timetable id
app.post('/api/timetable/:id/regenerate-pdf', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const id = req.params.id
    const t = await Timetable.findById(id).lean()
    if (!t) return res.status(404).json({ message: 'Timetable not found' })
    if (!t.content) return res.status(400).json({ message: 'No content to generate PDF from' })

    // pdfkit require consolidated at top of file
    const content = typeof t.content === 'string' ? (() => { try { return JSON.parse(t.content) } catch (e) { return null } })() : t.content
    const filename = `${Date.now()}_${String(t.class || 'cls')}_${String(t.section || 'ALL')}_timetable.pdf`.replace(/\s+/g, '_')
    const outPath = path.join(uploadsDir, filename)
    const pdfDoc = new PDFDocument({ margin: 30, size: 'A4' })
    const stream = fs.createWriteStream(outPath)
    pdfDoc.pipe(stream)

    pdfDoc.fontSize(18).text(String(t.name || 'Timetable'), { align: 'center' })
    pdfDoc.moveDown()

    if (content && typeof content === 'object') {
      const days = Object.keys(content)
      const periodOrder = []
      const seen = new Set()
      for (const d of days) {
        const row = content[d] || {}
        for (const p of Object.keys(row)) {
          if (!seen.has(p)) { seen.add(p); periodOrder.push(p) }
        }
      }

      const left = pdfDoc.page.margins.left
      const pageWidth = pdfDoc.page.width - pdfDoc.page.margins.left - pdfDoc.page.margins.right
      const dayCol = Math.max(80, Math.floor(pageWidth * 0.18))
      const remaining = Math.max(0, pageWidth - dayCol)
      const colWidth = periodOrder.length ? Math.floor(remaining / periodOrder.length) : remaining
      const headerH = 26
      const rowH = 22

      let xStart = left
      let y = pdfDoc.y

      pdfDoc.font('Helvetica-Bold').fontSize(12)
      pdfDoc.fillColor('#111827')
      pdfDoc.rect(xStart, y, dayCol, headerH).fill('#f3f4f6')
      pdfDoc.fillColor('#0f172a').text('Day', xStart + 6, y + 6, { width: dayCol - 12, align: 'left' })
      xStart += dayCol
      for (const p of periodOrder) {
        pdfDoc.fillColor('#111827')
        pdfDoc.rect(xStart, y, colWidth, headerH).fill('#f3f4f6')
        pdfDoc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text(p, xStart + 4, y + 6, { width: colWidth - 8, align: 'center' })
        xStart += colWidth
      }

      pdfDoc.font('Helvetica').fontSize(10)
      y += headerH
      for (const d of days) {
        xStart = left
        pdfDoc.fillColor('#ffffff').rect(xStart, y, dayCol, rowH).fill()
        pdfDoc.fillColor('#0b1220').text(String(d), xStart + 6, y + 6, { width: dayCol - 12, align: 'left' })
        xStart += dayCol
        for (const p of periodOrder) {
          pdfDoc.fillColor('#ffffff').rect(xStart, y, colWidth, rowH).fill()
          const txt = String((content[d] && content[d][p]) || '')
          pdfDoc.fillColor('#0b1220').text(txt, xStart + 4, y + 6, { width: colWidth - 8, align: 'center' })
          xStart += colWidth
        }

        pdfDoc.strokeColor('#e5e7eb').lineWidth(0.5)
        let vx = left
        pdfDoc.moveTo(vx, y).lineTo(vx + dayCol + colWidth * periodOrder.length, y).stroke()
        for (let i = 0; i <= periodOrder.length; i++) {
          pdfDoc.moveTo(vx, y).lineTo(vx, y + rowH).stroke()
          vx += (i === 0 ? dayCol : colWidth)
        }
        pdfDoc.moveTo(left, y + rowH).lineTo(left + dayCol + colWidth * periodOrder.length, y + rowH).stroke()

        y += rowH
        if (y + rowH + 60 > pdfDoc.page.height - pdfDoc.page.margins.bottom) {
          pdfDoc.addPage()
          y = pdfDoc.page.margins.top
        }
      }
      pdfDoc.moveDown()
    } else {
      pdfDoc.fontSize(12).text(String(t.content))
    }

    pdfDoc.end()
    await new Promise((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject) })

    const fileP = `/uploads/${filename}`
    const updated = await Timetable.findByIdAndUpdate(id, { filePath: fileP, mime: 'application/pdf' }, { new: true }).lean()
    return res.json(updated)
  } catch (e) {
    console.error('Failed to regenerate single timetable PDF:', e && e.message)
    return res.status(500).json({ message: e.message })
  }
})

// Faculty: list submissions for an assignment
app.get('/api/assignments/:id/submissions', verifyToken, requireRole('faculty'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const subs = await Submission.find({ assignmentId: req.params.id }).sort({ createdAt: -1 }).lean()
    return res.json(subs)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Faculty: extend due date (edit assignment)
app.put('/api/assignments/:id/extend', verifyToken, requireRole('faculty'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { dueDate } = req.body || {}
    if (!dueDate) return res.status(400).json({ message: 'dueDate required' })
    const a = await Assignment.findById(req.params.id)
    if (!a) return res.status(404).json({ message: 'Assignment not found' })
    a.dueDate = new Date(dueDate)
    await a.save()
    return res.json(a)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: delete a student (remove student record and associated user, notify student)
app.delete('/api/students/:id', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const removed = await Student.findByIdAndDelete(req.params.id).lean()
    if (!removed) return res.status(404).json({ message: 'Student not found' })

    // Remove associated login user if it's a student account
    try {
      await User.findOneAndDelete({ username: removed.email, role: 'student' }).catch(() => {})
    } catch (e) { /* ignore */ }

    // send removal email to student
    try {
      const to = removed.email
      if (to) {
        const subject = 'Notice: Your student account has been removed'
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
        `
        sendMail({ to, subject, html }).catch(() => {})
      }
    } catch (mailErr) {
      console.warn('Failed to send student removal email:', mailErr && (mailErr.message || String(mailErr)))
    }

    // emit SSE event so admin UI can refresh lists
    try { sendSseEvent('student_deleted', { id: removed._id, email: removed.email, name: removed.name }) } catch (e) {}

    return res.json({ ok: true })
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Admin: update a student's class/section/roll/name and optional demographics
app.put('/api/students/:id', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const id = req.params.id
    const update = {}
    const { class: cls, section, rollNo, name, gender, category, religion, medium, house } = req.body || {}
    if (cls !== undefined) update.class = String(cls)
    if (section !== undefined) update.section = String(section)
    if (rollNo !== undefined) update.rollNo = String(rollNo)
    if (name !== undefined) update.name = String(name)
    if (gender !== undefined) update.gender = String(gender)
    if (category !== undefined) update.category = String(category)
    if (religion !== undefined) update.religion = String(religion)
    if (medium !== undefined) update.medium = String(medium)
    if (house !== undefined) update.house = String(house)
    if (!id) return res.status(400).json({ message: 'id required' })

    const student = await Student.findById(id)
    if (!student) return res.status(404).json({ message: 'Student not found' })

    // detect changes for notification
    const before = { name: student.name, class: student.class, section: student.section, rollNo: student.rollNo, gender: student.gender, category: student.category, religion: student.religion, medium: student.medium, house: student.house }

    // If medium changed, reassign section & roll number to balance sections
    const beforeMedium = student.medium
    Object.assign(student, update)
    if (medium !== undefined && String(beforeMedium || '') !== String(medium || '')) {
      // find a section with capacity < 50 for the student's current class
      const sections = ['A','B','C','D']
      let assignedSection = null
      for (const s of sections) {
        const count = await Student.countDocuments({ class: String(student.class), section: s })
        if (count < 50) { assignedSection = s; break }
      }
      if (assignedSection) {
        const existingCount = await Student.countDocuments({ class: String(student.class), section: assignedSection })
        const newRollNo = `${String(student.class)}${assignedSection}${existingCount + 1}`
        student.section = assignedSection
        student.rollNo = newRollNo
      }
    }
    await student.save()

    // also update associated User.name if user exists
    try {
      const user = await User.findOne({ username: student.email, role: 'student' })
      if (user && name !== undefined) {
        user.name = String(name)
        await user.save()
      }
    } catch (e) { /* ignore */ }

    // prepare list of changed fields
    const after = { name: student.name, class: student.class, section: student.section, rollNo: student.rollNo, gender: student.gender, category: student.category, religion: student.religion, medium: student.medium, house: student.house }
    const changed = []
    for (const k of ['name', 'class', 'section', 'rollNo', 'gender', 'category', 'religion', 'medium', 'house']) {
      if (String(before[k] || '') !== String(after[k] || '')) changed.push(k)
    }

    // send notification email if something changed
    if (changed.length > 0) {
      try {
        const to = student.email
        if (to) {
          const loginUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || ''
          const subject = 'Your student record has been updated'
            const rows = [`<tr><td style=\"font-weight:700;padding:6px 0\">Name</td><td style=\"padding:6px 0\">${after.name || '-'}</td></tr>`,
            `<tr><td style="font-weight:700;padding:6px 0">Class</td><td style="padding:6px 0">${after.class || '-'}</td></tr>`,
            `<tr><td style="font-weight:700;padding:6px 0">Section</td><td style="padding:6px 0">${after.section || '-'}</td></tr>`,
            `<tr><td style=\"font-weight:700;padding:6px 0\">Roll No</td><td style=\"padding:6px 0\">${after.rollNo || '-'}</td></tr>`,
            `<tr><td style=\"font-weight:700;padding:6px 0\">Gender</td><td style=\"padding:6px 0\">${after.gender || '-'}</td></tr>`,
            `<tr><td style=\"font-weight:700;padding:6px 0\">Category</td><td style=\"padding:6px 0\">${after.category || '-'}</td></tr>`,
            `<tr><td style=\"font-weight:700;padding:6px 0\">Religion</td><td style=\"padding:6px 0\">${after.religion || '-'}</td></tr>`,
            `<tr><td style=\"font-weight:700;padding:6px 0\">Medium</td><td style=\"padding:6px 0\">${after.medium || '-'}</td></tr>`,
            `<tr><td style=\"font-weight:700;padding:6px 0\">House</td><td style=\"padding:6px 0\">${after.house || '-'}</td></tr>`]

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
          `
          await sendMail({ to, subject, html }).catch(() => {})
        }
      } catch (mailErr) {
        console.warn('Failed to send student update email:', mailErr && (mailErr.message || String(mailErr)))
      }
    }

    try { sendSseEvent('student_updated', { id: student._id, email: student.email, changed }) } catch (e) {}

    return res.json(student)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Faculty: change a student's class (assign new section & roll no automatically)
app.put('/api/students/:id/change-class', verifyToken, requireRole('faculty'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const id = req.params.id
    const { class: newClass, section: requestedSection } = req.body || {}
    if (!id || !newClass) return res.status(400).json({ message: 'id and class required' })
    const student = await Student.findById(id)
    if (!student) return res.status(404).json({ message: 'Student not found' })

    // Ensure the calling faculty is the class teacher for the student's current class
    // Resolve faculty record from the authenticated user
    let faculty = null
    try {
      const me = req.user || {}
      faculty = await Faculty.findOne({ email: me.username }).catch(() => null)
      if (!faculty && me.name) faculty = await Faculty.findOne({ name: me.name }).catch(() => null)
      if (!faculty && me.contact) faculty = await Faculty.findOne({ contact: me.contact }).catch(() => null)
    } catch (e) {
      faculty = null
    }
    if (!faculty) return res.status(403).json({ message: 'Faculty record not found for this user' })

    const isClassTeacherForCurrent = (faculty.assignments || []).some(a => String(a.class) === String(student.class) && a.isClassTeacher)
    if (!isClassTeacherForCurrent) return res.status(403).json({ message: 'Only the class teacher of this class can change class or section' })

    // assign section: if a specific section was requested, try to use it (with capacity check)
    const sections = ['A','B','C','D']
    let assignedSection = null
    if (requestedSection) {
      const normalized = String(requestedSection || '').trim().toUpperCase()
      if (!sections.includes(normalized)) return res.status(400).json({ message: 'Invalid section requested' })
      const cnt = await Student.countDocuments({ class: String(newClass), section: normalized })
      if (cnt >= 50) return res.status(400).json({ message: 'Requested section is full' })
      assignedSection = normalized
    } else {
      for (const s of sections) {
        const count = await Student.countDocuments({ class: String(newClass), section: s })
        if (count < 50) { assignedSection = s; break }
      }
    }
    if (!assignedSection) return res.status(400).json({ message: 'No section available for the selected class' })

    const existingCount = await Student.countDocuments({ class: String(newClass), section: assignedSection })
    const rollNo = `${String(newClass)}${assignedSection}${existingCount + 1}`

    const before = { class: student.class, section: student.section, rollNo: student.rollNo }
    student.class = String(newClass)
    student.section = assignedSection
    student.rollNo = rollNo
    await student.save()

    // update associated user name if exists
    try {
      const user = await User.findOne({ username: student.email, role: 'student' })
      if (user) { user.name = student.name || user.name; await user.save() }
    } catch (e) {}

    // notify student by email
    try {
      const to = student.email
      if (to) {
        const subject = 'Your student class has been updated'
        const html = `Hello ${student.name || ''},\n\nYour class has been changed to ${student.class} (Section ${student.section}, Roll ${student.rollNo}).\n\nIf you have questions, contact administration.`
        await sendMail({ to, subject, text: html }).catch(() => {})
      }
    } catch (mailErr) { console.warn('Failed to send class-change email:', mailErr && (mailErr.message || String(mailErr))) }

    try { sendSseEvent('student_updated', { id: student._id, class: student.class, section: student.section }) } catch (e) {}
    return res.json(student)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Faculty: set a student's stream (only permitted for faculty role)
app.put('/api/students/:id/stream', verifyToken, requireRole('faculty'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const id = req.params.id
    const { stream } = req.body || {}
    if (!id) return res.status(400).json({ message: 'id required' })
    const student = await Student.findById(id)
    if (!student) return res.status(404).json({ message: 'Student not found' })

    // Only applicable for classes 11 and 12; enforce on server as well
    const cls = String(student.class || '')
    if (!(cls === '11' || cls === '12')) return res.status(400).json({ message: 'Stream only applicable for class 11 and 12' })

    student.stream = stream ? String(stream).trim() : ''
    await student.save()

    try { sendSseEvent('student_updated', { id: student._id, changed: ['stream'] }) } catch (e) {}

    return res.json(student)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Faculty: block/unblock student (faculty-initiated)
app.put('/api/students/:id/block-by-faculty', verifyToken, requireRole('faculty'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const id = req.params.id
    const { block } = req.body || {}
    if (block === undefined) return res.status(400).json({ message: 'block required' })
    const student = await Student.findById(id)
    if (!student) return res.status(404).json({ message: 'Student not found' })

    const user = await User.findOne({ username: student.email, role: 'student' })
    let finalBlocked = !!block
    if (user) { user.disabled = !!block; await user.save(); finalBlocked = !!user.disabled }
    student.blocked = !!block
    await student.save()

    // email notify
    try {
      const to = student.email
      if (to) {
        const subject = finalBlocked ? 'Your student account has been blocked' : 'Your student account has been unblocked'
        const text = `Dear ${student.name || ''},\n\nYour account has been ${finalBlocked ? 'blocked' : 'unblocked'} by the faculty. Please contact admin for more details.`
        await sendMail({ to, subject, text }).catch(() => {})
      }
    } catch (mailErr) { console.warn('Failed to send block email:', mailErr && (mailErr.message || String(mailErr))) }

    try { sendSseEvent('student_blocked', { id: student._id, email: student.email, blocked: !!finalBlocked }) } catch (e) {}
    return res.json({ ok: true, blocked: !!finalBlocked })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Faculty: create a delete request for a student (goes to admin approvals)
app.post('/api/students/:id/delete-request', verifyToken, requireRole('faculty'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const id = req.params.id
    const { note } = req.body || {}
    if (!id) return res.status(400).json({ message: 'id required' })
    const student = await Student.findById(id).lean()
    if (!student) return res.status(404).json({ message: 'Student not found' })
    const existing = await DeletionRequest.findOne({ studentId: id, status: 'pending' }).lean()
    if (existing) return res.status(409).json({ message: 'Delete request already pending' })

    const dr = await DeletionRequest.create({ studentId: id, studentEmail: student.email || '', requestedBy: req.user.sub, requestedByName: req.user.name || req.user.username, note: note || '', status: 'pending' })
    try { sendSseEvent('student_delete_requested', { id: dr._id, studentId: id, email: student.email }) } catch (e) {}
    return res.status(201).json(dr)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: list delete requests
app.get('/api/students/delete-requests', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const items = await DeletionRequest.find().sort({ createdAt: -1 }).lean()
    return res.json(items)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: approve a delete request (deletes student and user)
app.put('/api/students/delete-requests/:id/approve', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const id = req.params.id
    const reqDoc = await DeletionRequest.findById(id)
    if (!reqDoc) return res.status(404).json({ message: 'Request not found' })
    if (reqDoc.status !== 'pending') return res.status(400).json({ message: 'Request already processed' })

    const student = await Student.findById(reqDoc.studentId).lean()
    if (student) {
      await Student.deleteOne({ _id: student._id })
      try { await User.findOneAndDelete({ username: student.email, role: 'student' }).catch(() => {}) } catch (e) {}
    }
    reqDoc.status = 'approved'
    await reqDoc.save()

    // notify student by email
    try {
      const to = reqDoc.studentEmail
      if (to) {
        const subject = 'Student record deleted'
        const text = `Dear ${reqDoc.requestedByName || ''},\n\nYour delete request has been approved and the student record has been removed.`
        await sendMail({ to, subject, text }).catch(() => {})
      }
    } catch (mailErr) { console.warn('Failed to send deletion approved email:', mailErr && (mailErr.message || String(mailErr))) }

    try { sendSseEvent('student_deleted', { id: reqDoc.studentId, email: reqDoc.studentEmail }) } catch (e) {}
    return res.json({ ok: true })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admin: block/unblock a student's login account (by student id)
app.put('/api/students/:id/block', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const id = req.params.id
    const { block } = req.body || {}
    if (!id) return res.status(400).json({ message: 'id required' })

    // load student document (not lean) so we can set a student-level blocked flag if needed
    const studentDoc = await Student.findById(id)
    if (!studentDoc) return res.status(404).json({ message: 'Student not found' })

    // try to find associated login user
    const user = await User.findOne({ username: studentDoc.email, role: 'student' })

    // if user exists, set its disabled flag
    let finalBlocked = !!block
    if (user) {
      user.disabled = !!block
      await user.save()
      finalBlocked = !!user.disabled
    }

    // also persist blocked flag on student record so block state is visible even without a User
    studentDoc.blocked = !!block
    await studentDoc.save()

    // send notification email to student about block/unblock only if email exists
    try {
      const to = studentDoc.email
      if (to) {
        const loginUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || ''
        const subject = finalBlocked ? 'Your student account has been blocked' : 'Your student account has been unblocked'
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
        `
        await sendMail({ to, subject, html }).catch(() => {})
      }
    } catch (mailErr) {
      console.warn('Failed to send student block/unblock email:', mailErr && (mailErr.message || String(mailErr)))
    }

    try { sendSseEvent('student_blocked', { id: studentDoc._id, email: studentDoc.email, blocked: !!finalBlocked }) } catch (e) {}

    return res.json({ ok: true, blocked: !!finalBlocked })
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Faculty management: list, update, delete (admin only)
app.get('/api/faculty', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { name, employeeId, subject, email } = req.query || {}
    const q = {}
    if (name) q.name = { $regex: name, $options: 'i' }
    if (employeeId) q.employeeId = { $regex: employeeId, $options: 'i' }
    if (subject) q.subject = { $regex: subject, $options: 'i' }
    if (email) q.email = { $regex: email, $options: 'i' }
    const items = await Faculty.find(q).sort({ name: 1 }).lean()

    // enrich with blocked status from User collection (if a user exists with same email)
    try {
      const emails = items.map(i => i.email).filter(Boolean)
      const users = emails.length ? await User.find({ username: { $in: emails } }).lean() : []
      const userMap = {}
      for (const u of users) userMap[u.username] = u
      const enriched = items.map(i => ({ ...i, blocked: !!(i.email && userMap[i.email] && userMap[i.email].disabled) }))
      return res.json(enriched)
    } catch (e) {
      return res.json(items)
    }
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

app.put('/api/faculty/:id', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const update = req.body || {}
    const updated = await Faculty.findByIdAndUpdate(req.params.id, update, { new: true }).lean()
    if (!updated) return res.status(404).json({ message: 'Faculty not found' })
    return res.json(updated)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Admin: block or unblock a faculty's user account (by faculty id)
app.put('/api/faculty/:id/block', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const { block } = req.body || {}
    const f = await Faculty.findById(req.params.id).lean()
    if (!f) return res.status(404).json({ message: 'Faculty not found' })

    const user = await User.findOne({ username: f.email, role: 'faculty' })
    if (!user) return res.status(404).json({ message: 'User account not found for this faculty' })

    user.disabled = !!block
    await user.save()

    try { sendSseEvent('faculty_blocked', { id: f._id, email: f.email, blocked: user.disabled }) } catch (e) {}

    return res.json({ ok: true, blocked: user.disabled })
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

app.delete('/api/faculty/:id', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const removed = await Faculty.findByIdAndDelete(req.params.id).lean()
    if (!removed) return res.status(404).json({ message: 'Faculty not found' })
    // send removal email to faculty
    try {
      const to = removed.email
      if (to) {
        const subject = 'Notice: You have been removed as Faculty'
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
        `
        sendMail({ to, subject, html }).catch(() => {})
      }
    } catch (mailErr) {
      console.warn('Failed to send removal email:', mailErr && (mailErr.message || String(mailErr)))
    }

    // try to also remove the login user for this faculty (if any)
    try {
      const u = await User.findOneAndDelete({ username: removed.email, role: 'faculty' }).lean().catch(() => null)
      if (u) console.log('Removed user account for', removed.email)
    } catch (e) { console.warn('Failed to remove user account for deleted faculty', e && e.message) }

    // emit SSE event so admin UI can refresh lists
    try { sendSseEvent('faculty_deleted', { id: removed._id, email: removed.email, name: removed.name }) } catch (e) {}

    return res.json({ ok: true })
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Syllabus
app.post('/api/syllabus', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  const { subject, content } = req.body || {}
  if (!subject) return res.status(400).json({ message: 'subject required' })
  try {
    const s = await Syllabus.findOneAndUpdate({ subject }, { content, uploadedBy: req.user.sub }, { upsert: true, new: true })
    return res.status(201).json(s)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

app.get('/api/syllabus', async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const items = await Syllabus.find().lean()
    return res.json(items)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Timetable endpoints - allow admin to upload a timetable (file or JSON content)
app.post('/api/timetable', verifyToken, requireRole('admin'), upload.single('file'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const cls = req.body.class || req.body.k || req.body.klass
    const section = req.body.section || req.body.sec || 'ALL'
    const name = req.body.name || (req.file && req.file.originalname) || `Timetable ${cls || ''} ${section || ''}`
    const content = req.body.content || null
    if (!cls) return res.status(400).json({ message: 'class required' })

    const doc = { class: String(cls), section: section || 'ALL', name, uploadedBy: req.user && req.user.sub }
    if (req.file) {
      doc.mime = req.file.mimetype
      doc.filePath = `/uploads/${req.file.filename}`
    }
    if (content) doc.content = content

    let created = await Timetable.create(doc)

    // If JSON content was provided and no file uploaded, generate a PDF snapshot and save it to uploads
    try {
      if (content && !req.file) {
        try {
          // pdfkit require consolidated at top of file
          const filename = Date.now() + `_timetable.pdf`
          const outPath = path.join(uploadsDir, filename)
          const pdfDoc = new PDFDocument({ margin: 30, size: 'A4' })
          const stream = fs.createWriteStream(outPath)
          pdfDoc.pipe(stream)

          // attempt to parse JSON content (it may be a string)
          let parsed = null
          try { parsed = typeof content === 'string' ? JSON.parse(content) : content } catch (e) { parsed = null }

          // Render a simple printable timetable
          pdfDoc.fontSize(18).text(String(name || 'Timetable'), { align: 'center' })
          pdfDoc.moveDown()

          if (parsed && typeof parsed === 'object') {
            const days = Object.keys(parsed)
            const periodOrder = []
            const seen = new Set()
            for (const d of days) {
              const row = parsed[d] || {}
              for (const p of Object.keys(row)) {
                if (!seen.has(p)) { seen.add(p); periodOrder.push(p) }
              }
            }

            // Table layout
            const left = pdfDoc.page.margins.left
            const pageWidth = pdfDoc.page.width - pdfDoc.page.margins.left - pdfDoc.page.margins.right
            const dayCol = Math.max(80, Math.floor(pageWidth * 0.18))
            const remaining = Math.max(0, pageWidth - dayCol)
            const colWidth = periodOrder.length ? Math.floor(remaining / periodOrder.length) : remaining
            const headerH = 26
            const rowH = 22

            let xStart = left
            let y = pdfDoc.y

            // header
            pdfDoc.font('Helvetica-Bold').fontSize(12)
            pdfDoc.fillColor('#111827')
            pdfDoc.rect(xStart, y, dayCol, headerH).fill('#f3f4f6')
            pdfDoc.fillColor('#0f172a').text('Day', xStart + 6, y + 6, { width: dayCol - 12, align: 'left' })
            xStart += dayCol
            for (const p of periodOrder) {
              pdfDoc.fillColor('#111827')
              pdfDoc.rect(xStart, y, colWidth, headerH).fill('#f3f4f6')
              pdfDoc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text(p, xStart + 4, y + 6, { width: colWidth - 8, align: 'center' })
              xStart += colWidth
            }

            // rows
            pdfDoc.font('Helvetica').fontSize(10)
            y += headerH
            for (const d of days) {
              xStart = left
              pdfDoc.fillColor('#ffffff').rect(xStart, y, dayCol, rowH).fill()
              pdfDoc.fillColor('#0b1220').text(String(d), xStart + 6, y + 6, { width: dayCol - 12, align: 'left' })
              xStart += dayCol
              for (const p of periodOrder) {
                pdfDoc.fillColor('#ffffff').rect(xStart, y, colWidth, rowH).fill()
                const txt = String((parsed[d] && parsed[d][p]) || '')
                pdfDoc.fillColor('#0b1220').text(txt, xStart + 4, y + 6, { width: colWidth - 8, align: 'center' })
                xStart += colWidth
              }

              // borders
              pdfDoc.strokeColor('#e5e7eb').lineWidth(0.5)
              let vx = left
              pdfDoc.moveTo(vx, y).lineTo(vx + dayCol + colWidth * periodOrder.length, y).stroke()
              for (let i = 0; i <= periodOrder.length; i++) {
                pdfDoc.moveTo(vx, y).lineTo(vx, y + rowH).stroke()
                vx += (i === 0 ? dayCol : colWidth)
              }
              pdfDoc.moveTo(left, y + rowH).lineTo(left + dayCol + colWidth * periodOrder.length, y + rowH).stroke()

              y += rowH
              if (y + rowH + 60 > pdfDoc.page.height - pdfDoc.page.margins.bottom) {
                pdfDoc.addPage()
                y = pdfDoc.page.margins.top
              }
            }
            pdfDoc.moveDown()
          } else {
            pdfDoc.fontSize(12).text(String(content))
          }

          pdfDoc.end()
          // await stream finish
          await new Promise((resolve, reject) => {
            stream.on('finish', resolve)
            stream.on('error', reject)
          })

          // update timetable doc with filePath and mime
          const fileP = `/uploads/${filename}`
          created = await Timetable.findByIdAndUpdate(created._id, { filePath: fileP, mime: 'application/pdf' }, { new: true })
        } catch (pdfErr) {
          console.warn('Failed to generate timetable PDF:', pdfErr && (pdfErr.message || String(pdfErr)))
        }
      }
    } catch (inner) {
      console.warn('Unexpected error while generating timetable PDF:', inner && (inner.message || String(inner)))
    }

    try { sendSseEvent('timetable_uploaded', { id: created._id, class: created.class, section: created.section, name: created.name }) } catch (e) {}
    return res.status(201).json(created)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Query timetables for a class/section. Returns history (newest-first).
app.get('/api/timetable', async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const cls = req.query.class || req.query.k || null
    const section = req.query.section || req.query.sec || null
    if (!cls) return res.json([])
    const q = { class: String(cls) }
    if (section) {
      q.$or = [{ section }, { section: 'ALL' }]
    }
    const items = await Timetable.find(q).sort({ uploadedAt: -1 }).lean()
    return res.json(items)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Leaves

// Certificates: admin can generate/send certificates; users can list their certificates
const Certificate = require('./models/Certificate')

// Admin: create/generate a certificate (multipart: optional signature image + optional uploaded file)
app.post('/api/certificates', verifyToken, requireRole('admin'), upload.fields([{ name: 'file' }, { name: 'signature' }]), async (req, res) => {
  try {
    const { schoolName, title, recipientId, recipientType, recipientName, certificationFor, dateOfIssue } = req.body || {}
    if (!recipientName) return res.status(400).json({ message: 'recipientName required' })

    // prepare doc
    const doc = {
      schoolName: schoolName || '',
      title: title || '',
      recipientId: recipientId || null,
      recipientType: recipientType || 'User',
      recipientName: recipientName || '',
      certificationFor: certificationFor || '',
      dateOfIssue: dateOfIssue || '',
      uploadedBy: req.user && req.user.sub
    }

    // if client uploaded a file (PDF/DOC) just save and reference it
    if (req.files && req.files.file && req.files.file.length > 0) {
      const f = req.files.file[0]
      doc.mime = f.mimetype
      doc.filePath = `/uploads/${f.filename}`
    }

    // handle signature upload if provided
    if (req.files && req.files.signature && req.files.signature.length > 0) {
      const s = req.files.signature[0]
      doc.signaturePath = `/uploads/${s.filename}`
    } else if (req.body.signaturePath) {
      doc.signaturePath = req.body.signaturePath
    }

    // Try to resolve recipientId (Student/Faculty) to a login User id so recipients can fetch their certificates
    try {
      if (doc.recipientType === 'Student' && doc.recipientId) {
        const Student = require('./models/Student')
        const student = await Student.findById(doc.recipientId).lean().catch(() => null)
        if (student && student.email) {
          const user = await User.findOne({ username: student.email }).lean().catch(() => null)
          if (user) {
            doc.recipientId = user._id
          }
        }
      } else if (doc.recipientType === 'Faculty' && doc.recipientId) {
        const Faculty = require('./models/Faculty')
        const faculty = await Faculty.findById(doc.recipientId).lean().catch(() => null)
        if (faculty && faculty.email) {
          const user = await User.findOne({ username: faculty.email }).lean().catch(() => null)
          if (user) {
            doc.recipientId = user._id
          }
        }
      } else {
        // if recipientType is 'User' or other, leave as-is
      }
    } catch (e) {
      console.warn('Failed to resolve recipient to user id', e && e.message)
    }

    // If no file uploaded, attempt to generate a PDF certificate here (using pdfkit)
    if (!doc.filePath) {
      try {
        // pdfkit require consolidated at top of file
        const fname = Date.now() + `_certificate.pdf`
        const outPath = path.join(uploadsDir, fname)
        const pdfDoc = new PDFDocument({ size: 'A4', margin: 50 })
        const stream = fs.createWriteStream(outPath)
        pdfDoc.pipe(stream)

        // Improved colorful certificate layout
        const W = pdfDoc.page.width
        const H = pdfDoc.page.height

        // Outer colored border
        const outerPad = 24
        pdfDoc.save()
        pdfDoc.lineWidth(6).strokeColor('#2563eb')
        pdfDoc.roundedRect(outerPad, outerPad, W - outerPad * 2, H - outerPad * 2, 12).stroke()
        pdfDoc.restore()

        // Inner subtle border
        pdfDoc.save()
        pdfDoc.lineWidth(1).strokeColor('#cbd5e1')
        pdfDoc.roundedRect(outerPad + 8, outerPad + 8, W - (outerPad + 8) * 2, H - (outerPad + 8) * 2, 8).stroke()
        pdfDoc.restore()

        // Top ribbon/header
        const ribbonHeight = 80
        pdfDoc.save()
        pdfDoc.rect(outerPad + 10, outerPad + 10, W - (outerPad + 10) * 2, ribbonHeight).fill('#1e293b')
        pdfDoc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold')
        pdfDoc.text(String(doc.schoolName || ''), outerPad + 20, outerPad + 26, { width: W - (outerPad + 40), align: 'center' })
        pdfDoc.restore()

        // Title
        pdfDoc.moveDown(4)
        pdfDoc.fillColor('#0f172a').fontSize(28).font('Helvetica-Bold')
        pdfDoc.text(doc.title || 'Certificate of Appreciation', { align: 'center' })

        // Decorative line
        pdfDoc.moveDown(0.5)
        const midX = W / 2
        pdfDoc.strokeColor('#60a5fa').lineWidth(2)
        pdfDoc.moveTo(midX - 80, pdfDoc.y).lineTo(midX + 80, pdfDoc.y).stroke()

        // Subtitle / intro
        pdfDoc.moveDown(1)
        pdfDoc.fillColor('#334155').fontSize(14).font('Helvetica')
        pdfDoc.text('This is to certify that', { align: 'center' })

        // Recipient name
        pdfDoc.moveDown(0.5)
        pdfDoc.fontSize(26).font('Times-Bold').fillColor('#0b1220')
        pdfDoc.text(String(doc.recipientName || ''), { align: 'center' })

        // Certification body (wrapped)
        pdfDoc.moveDown(0.8)
        pdfDoc.fontSize(14).font('Helvetica').fillColor('#334155')
        const bodyText = String(doc.certificationFor || '') || 'For outstanding performance and contribution.'
        pdfDoc.text(bodyText, { align: 'center', width: W - 200, lineGap: 4 })

        // Date and metadata
        pdfDoc.moveDown(2)
        pdfDoc.fontSize(12).fillColor('#111827')
        pdfDoc.text(`Date of Issue: ${doc.dateOfIssue || ''}`, outerPad + 40, pdfDoc.y)

        // Signature area (right side)
        const sigWidth = 160
        const sigX = W - outerPad - sigWidth - 40
        const sigY = H - outerPad - 150
        if (doc.signaturePath) {
          try {
            const fname = String(doc.signaturePath || '').replace(/^\/uploads\//, '')
            const sigPath = path.join(uploadsDir, fname)
            if (fs.existsSync(sigPath)) {
              pdfDoc.image(sigPath, sigX, sigY, { width: sigWidth })
            }
          } catch (e) { console.warn('Failed to attach signature image', e && e.message) }
        }
        // signature line and label
        pdfDoc.moveTo(sigX, sigY + 80).lineTo(sigX + sigWidth, sigY + 80).strokeColor('#94a3b8').lineWidth(1).stroke()
        pdfDoc.fontSize(12).fillColor('#334155').text('Authorized Signature', sigX, sigY + 86, { width: sigWidth, align: 'center' })

        pdfDoc.end()
        await new Promise((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject) })
        doc.filePath = `/uploads/${fname}`
        doc.mime = 'application/pdf'
      } catch (e) {
        console.warn('Certificate PDF generation failed', e && e.message)
      }
    }

    const created = await Certificate.create(doc)
    return res.status(201).json(created)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// List certificates (admin)
app.get('/api/certificates', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await Certificate.find({}).sort({ uploadedAt: -1 }).lean().catch(() => [])
    return res.json(list)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// List my certificates (recipient)
app.get('/api/certificates/my', verifyToken, async (req, res) => {
  try {
    const userId = req.user && req.user.sub
    if (!userId) return res.status(401).json({ message: 'Not authenticated' })
    // Also include certificates where recipientName matches the user's name (case-insensitive)
    const uname = (req.user && req.user.name) ? String(req.user.name).trim() : ''
    const orClauses = [{ recipientId: userId }]
    if (uname) {
      function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
      orClauses.push({ recipientName: { $regex: `^${escapeRegex(uname)}$`, $options: 'i' } })
    }
    const list = await Certificate.find({ $or: orClauses }).sort({ uploadedAt: -1 }).lean().catch(() => [])
    return res.json(list)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.post('/api/leaves', verifyToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  const { from, to, reason } = req.body || {}
  if (!from || !to) return res.status(400).json({ message: 'from and to dates required' })
  try {
    const l = await Leave.create({ userId: req.user.sub, username: req.user.username, from: new Date(from), to: new Date(to), reason })
    return res.status(201).json(l)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

app.get('/api/leaves', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const all = await Leave.find().sort({ createdAt: -1 }).lean()
    return res.json(all)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

app.get('/api/leaves/my', verifyToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const mine = await Leave.find({ userId: req.user.sub }).sort({ createdAt: -1 }).lean()
    return res.json(mine)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Messages (Parent -> Admin)
app.post('/api/messages', verifyToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  const { parentName, studentName, className, subject, description, priority } = req.body || {}
  if (!description) return res.status(400).json({ message: 'description required' })
  try {
    const m = await Message.create({ parentName, studentName, className, subject, description, priority, createdBy: req.user.sub, createdByUsername: req.user.username })
    return res.status(201).json(m)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

app.get('/api/messages', verifyToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    if (req.user.role === 'admin') {
      const all = await Message.find().sort({ createdAt: -1 }).lean()
      return res.json(all)
    }
    // non-admins can only see their own messages
    const mine = await Message.find({ createdBy: req.user.sub }).sort({ createdAt: -1 }).lean()
    return res.json(mine)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

app.get('/api/messages/my', verifyToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const mine = await Message.find({ createdBy: req.user.sub }).sort({ createdAt: -1 }).lean()
    return res.json(mine)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

app.put('/api/messages/:id/status', verifyToken, async (req, res) => {
  const { status, note } = req.body || {}
  if (!status) return res.status(400).json({ message: 'status required' })
  try {
    const m = await Message.findById(req.params.id)
    if (!m) return res.status(404).json({ message: 'Message not found' })

    const isAdmin = req.user && req.user.role === 'admin'
    const isOwner = req.user && (String(m.createdBy) === String(req.user.sub) || (m.createdByUsername && m.createdByUsername === req.user.username))
    if (!isAdmin && !isOwner) return res.status(403).json({ message: 'Forbidden: insufficient role' })

    // Allow admins to set any status. Message owners (parents) may only add replies
    // which are represented by the 'Replied' status to avoid privilege escalation.
    if (!isAdmin && status !== 'Replied') return res.status(403).json({ message: 'Forbidden: insufficient role to set this status' })

    const entry = { by: req.user.username || req.user.sub, role: req.user.role || (isAdmin ? 'admin' : 'parent'), note: note || '', status, at: new Date() }
    m.status = status
    m.history = m.history || []
    m.history.push(entry)
    const saved = await m.save()
    return res.json(saved)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

app.put('/api/leaves/:id/status', verifyToken, requireRole('admin'), async (req, res) => {
  const { status, note } = req.body || {}
  if (!status) return res.status(400).json({ message: 'status required' })
  try {
    const leave = await Leave.findById(req.params.id)
    if (!leave) return res.status(404).json({ message: 'Leave not found' })

    leave.status = status
    leave.reviewedBy = req.user && (req.user.username || req.user.sub)
    leave.reviewedAt = new Date()
    leave.reviewNote = note || ''
    const saved = await leave.save()

    // If approved and user is faculty, auto-mark absent in faculty attendance for the date range
    try {
      if (String(status).toLowerCase() === 'approved') {
        // find faculty by email/username
        let faculty = await Faculty.findOne({ email: leave.username }).lean().catch(() => null)
        if (!faculty && leave.userId) {
          // attempt via userId mapping: if there's a Faculty with contact/email matching user
          const u = await User.findById(leave.userId).lean().catch(() => null)
          if (u && u.username) faculty = await Faculty.findOne({ email: u.username }).lean().catch(() => null)
        }
        if (faculty && faculty._id && leave.from && leave.to) {
          const start = new Date(leave.from); start.setHours(0,0,0,0)
          const end = new Date(leave.to); end.setHours(0,0,0,0)
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const ymd = d.toISOString().slice(0,10)
            let att = await FacultyAttendance.findOne({ date: ymd })
            const rec = { facultyId: faculty._id, status: 'absent', markedBy: req.user.sub }
            if (att) {
              // replace or add record for this faculty
              const idx = Array.isArray(att.records) ? att.records.findIndex(r => String(r.facultyId) === String(faculty._id)) : -1
              if (idx >= 0) att.records[idx] = rec; else att.records.push(rec)
              att.createdBy = req.user.sub
              await att.save()
            } else {
              await FacultyAttendance.create({ date: ymd, records: [rec], createdBy: req.user.sub })
            }
          }
        }
      }
    } catch (autoErr) { console.warn('Auto-mark absent for faculty leave failed:', autoErr && (autoErr.message || String(autoErr))) }

    // try to notify user by email (best-effort)
    try {
      let recipient = null
      // if username looks like an email, use it
      if (leave.username && String(leave.username).includes('@')) recipient = leave.username
      // else try to find a Student record with same username
      if (!recipient) {
        const student = await Student.findOne({ name: leave.username }).lean().catch(() => null)
        if (student && student.email) recipient = student.email
      }
      // as a fallback, try to locate a User with the id and use its contact/email-like fields
      if (!recipient && leave.userId) {
        const u = await User.findById(leave.userId).lean().catch(() => null)
        if (u && u.contact && String(u.contact).includes('@')) recipient = u.contact
      }

      if (recipient) {
        const subject = `Leave ${status}: ${leave.username}`
        const text = `Your leave request from ${leave.from.toISOString().slice(0,10)} to ${leave.to.toISOString().slice(0,10)} has been ${status}.\n\nNote from reviewer: ${note || ''}`
        
        let phone = null;
        if (u && u.contact) phone = u.contact;
        
        if (status === 'Approved' && phone) {
           await notifyEvent({ event: 'leave_approved', phone, message: text, emailOpts: { to: recipient, subject, text } }).catch(() => {})
        } else {
           await sendMail({ to: recipient, subject, text })
        }
      } else {
        console.log('No email found for leave user, skipping email')
      }
    } catch (mailErr) {
      console.warn('Failed to send leave status email:', mailErr && mailErr.message)
    }

    return res.json(saved)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Faculty: request deletion of a student (creates a DeletionRequest)
app.post('/api/students/:id/delete-request', verifyToken, requireRole('faculty'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const student = await Student.findById(req.params.id).lean()
    if (!student) return res.status(404).json({ message: 'Student not found' })
    const { note } = req.body || {}
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
    }
    const created = await DeletionRequest.create(doc)
    try { sendSseEvent('student_delete_requested', { id: created._id, studentId: student._id, studentEmail: student.email }) } catch (e) {}
    return res.status(201).json(created)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Admin: list deletion requests
app.get('/api/students/delete-requests', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const items = await DeletionRequest.find().sort({ createdAt: -1 }).lean()
    return res.json(items)
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Admin: approve a deletion request (deletes the student and associated user)
app.put('/api/students/delete-requests/:id/approve', verifyToken, requireRole('admin'), async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const reqDoc = await DeletionRequest.findById(req.params.id)
    if (!reqDoc) return res.status(404).json({ message: 'Delete request not found' })

    // delete student record if exists
    try {
      if (reqDoc.studentId) {
        await Student.findByIdAndDelete(reqDoc.studentId).catch(() => null)
      }
      // also delete associated User (login) if exists
      if (reqDoc.studentEmail) {
        await User.findOneAndDelete({ username: reqDoc.studentEmail, role: 'student' }).catch(() => null)
      }
    } catch (inner) { console.warn('Error deleting student/user during approve:', inner && inner.message) }

    reqDoc.status = 'approved'
    await reqDoc.save()

    // notify requester and student by email (best-effort)
    try {
      const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER || null
      const toStudent = reqDoc.studentEmail || null
      if (toStudent) {
        const subject = 'Account deleted by admin'
        const html = `<div style="font-family:Arial,sans-serif;padding:20px;background:#f7f7fb"><div style="max-width:600px;margin:0 auto;background:#fff;padding:18px;border-radius:8px">Your student account (${reqDoc.studentEmail}) has been removed by admin.</div></div>`
        await sendMail({ to: toStudent, subject, html }).catch(() => {})
      }
      // notify requester (if requester has an email username)
      if (reqDoc.requestedByName) {
        const subject = 'Delete request approved'
        const html = `<div style="font-family:Arial,sans-serif;padding:20px;background:#f7f7fb"><div style="max-width:600px;margin:0 auto;background:#fff;padding:18px;border-radius:8px">Your delete request for ${reqDoc.studentEmail || reqDoc.studentName} has been approved and the student record removed.</div></div>`
        // try to find the requester user and email
        try {
          const requester = await User.findById(reqDoc.requestedBy).lean().catch(() => null)
          if (requester && requester.username && String(requester.username).includes('@')) {
            await sendMail({ to: requester.username, subject, html }).catch(() => {})
          }
        } catch (e) {}
      }
    } catch (mailErr) { console.warn('Failed to send delete approval emails:', mailErr && mailErr.message) }

    try { sendSseEvent('student_deleted', { studentEmail: reqDoc.studentEmail, studentId: reqDoc.studentId }) } catch (e) {}

    return res.json({ ok: true })
  } catch (e) {
    return res.status(500).json({ message: e.message })
  }
})

// Bulk test creation from a .docx file (parses questions/options/answers/marks)
app.post('/api/tests/bulk', verifyToken, requireRole(['admin','faculty']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'file (docx) required' })
    if (!mammoth) return res.status(500).json({ message: 'Server missing dependency: mammoth. Run `npm install mammoth` in backend.' })

    const { title, description, classes, sections, start, durationMinutes, term } = req.body || {}
    if (!title) return res.status(400).json({ message: 'title required' })

    const fp = path.join(uploadsDir, req.file.filename)
    const ext = String(path.extname(fp) || '').toLowerCase()
    let text = ''
    if (ext === '.pdf') {
      if (!pdfParse) return res.status(500).json({ message: 'Server missing dependency: pdf-parse. Run `npm install pdf-parse` in backend to support PDF parsing.' })
      const dataBuffer = fs.readFileSync(fp)
      const pdfRes = await pdfParse(dataBuffer)
      text = pdfRes && pdfRes.text ? String(pdfRes.text) : ''
    } else {
      if (!mammoth) return res.status(500).json({ message: 'Server missing dependency: mammoth. Run `npm install mammoth` in backend.' })
      const data = await mammoth.extractRawText({ path: fp })
      text = data && data.value ? String(data.value) : ''
    }
    if (!text) return res.status(400).json({ message: 'Empty or unreadable document' })

    // build blocks by detecting question-start lines (e.g. "Q1.", "1.")
    const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
    const blocks = []
    let current = []
    const questionStartRegex = /^\s*(?:Q\s*\d+\.?|\d+\.)/i
    for (const line of rawLines) {
      if (questionStartRegex.test(line) && current.length) {
        blocks.push(current.join('\n'))
        current = [line]
      } else {
        current.push(line)
      }
    }
    if (current.length) blocks.push(current.join('\n'))
    const questions = []

    const optPrefix = /^[A-Da-d][)\.|\-]\s*/
    const optionLineRegex = /^([A-Da-d]|\d+)\s*[\)\.\-]\s*(.*)$/
    // allow forms like "Correct Option : C" or "Correct Answer : Washington DC"
    const answerLineRegex = /(answer|ans|correct)(?:\s*\w*)*\s*[:\-]?\s*([A-Za-z0-9 ]+)/i
    const marksRegex = /(\d+)\s*(marks|mark|mks)/i

    for (const block of blocks) {
      const lines = String(block).split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      if (!lines.length) continue

      // find first option line index
      let firstOptIdx = lines.findIndex(l => optionLineRegex.test(l) || optPrefix.test(l))
      if (firstOptIdx === -1) {
        // maybe single-line question without options — skip
        continue
      }

      // question text is lines before firstOptIdx
      const qText = lines.slice(0, firstOptIdx).join(' ')
      const optionLines = []
      for (let i = firstOptIdx; i < lines.length; i++) {
        const ln = lines[i]
        if (optionLineRegex.test(ln)) {
          const m = ln.match(optionLineRegex)
          optionLines.push(m[2].trim())
        } else if (optPrefix.test(ln)) {
          optionLines.push(ln.replace(optPrefix, '').trim())
        } else {
          // stop options if we hit an answer/marks line
          if (answerLineRegex.test(ln) || marksRegex.test(ln)) break
        }
      }
      if (!optionLines.length) continue

      // find answer in block — be permissive to match lines like
      // "Correct Answer option : A" or "Correct Answer : A"
      let correct = null
      const postLines = lines.slice(firstOptIdx + optionLines.length)
      for (const l of postLines) {
        let a = null
        const am = l.match(answerLineRegex)
        if (am && am[2]) {
          a = String(am[2]).trim()
        } else if (/correct/i.test(l)) {
          // try to find a trailing letter or number in the same line
          const m = l.match(/([A-Da-d]|\d+)\b/g)
          if (m && m.length) a = m[m.length - 1]
        }

        if (a) {
          // if letter, map to option
          if (/^[A-Da-d]$/.test(a)) {
            const idx = a.toUpperCase().charCodeAt(0) - 65
            if (optionLines[idx]) correct = optionLines[idx]
          } else if (/^\d+$/.test(a)) {
            const idx = Number(a) - 1
            if (optionLines[idx]) correct = optionLines[idx]
          } else {
            // try to match by option text
            const found = optionLines.find(opt => opt.toLowerCase().includes(String(a).toLowerCase()))
            if (found) correct = found
          }
        }

        if (correct) break
        // also detect inline markers like '(correct)' inside remaining lines
        if (/\(correct\)|\*correct\*|\*\s*\(|\(ans\)/i.test(l)) {
          for (const opt of optionLines) {
            if (/\(correct\)|\*correct\*|\*\s*$|\(ans\)/i.test(opt)) {
              correct = opt.replace(/\(correct\)|\*correct\*|\*|\(ans\)/ig, '').trim()
              break
            }
          }
          if (correct) break
        }
      }

      // If not found in postLines, search the entire block for variants like "Correct Option : A"
      if (!correct) {
        for (const l of lines) {
          let a = null
          const am = l.match(answerLineRegex)
          if (am && am[2]) a = String(am[2]).trim()
          else if (/correct/i.test(l)) {
            const m = l.match(/([A-Da-d]|\d+)\b/g)
            if (m && m.length) a = m[m.length - 1]
          }

          if (a) {
            if (/^[A-Da-d]$/.test(a)) {
              const idx = a.toUpperCase().charCodeAt(0) - 65
              if (optionLines[idx]) { correct = optionLines[idx]; break }
            } else if (/^\d+$/.test(a)) {
              const idx = Number(a) - 1
              if (optionLines[idx]) { correct = optionLines[idx]; break }
            } else {
              const found = optionLines.find(opt => opt.toLowerCase().includes(String(a).toLowerCase()))
              if (found) { correct = found; break }
            }
          }
        }
      }

      // if not found, search options for '(correct)' or '*' markers
      if (!correct) {
        for (const opt of optionLines) {
          if (/\(correct\)|\*correct\*|\*\s*$/.test(opt) || /\(ans\)/i.test(opt)) {
            correct = opt.replace(/\(correct\)|\*correct\*|\*|\(ans\)/ig, '').trim()
            break
          }
        }
      }

      // marks for question (search whole block)
      let marks = 1
      const mk = block.match(marksRegex)
      if (mk) marks = Number(mk[1]) || 1

      questions.push({ questionText: qText, options: optionLines, correctAnswer: correct, marks })
    }

    // create TestSeries doc
    const cls = Array.isArray(classes) ? classes : (classes ? String(classes).split(',').map(s => s.trim()).filter(Boolean) : [])
    const secs = Array.isArray(sections) ? sections : (sections ? String(sections).split(',').map(s => s.trim()).filter(Boolean) : [])
    let ts = null
    if (!dbConnected) {
      ts = { _id: makeId('t_'), title, term: term || 'Term 1', type: 'bulk', link: '', filePath: `/uploads/${req.file.filename}`, classes: cls, sections: secs, start: start ? new Date(start) : null, durationMinutes: durationMinutes ? Number(durationMinutes) : null, description: description || '', createdBy: req.user.sub, createdAt: new Date(), updatedAt: new Date() }
      inMemoryTests.push(ts)
    } else {
      ts = await TestSeries.create({ title, term: term || 'Term 1', type: 'bulk', link: '', filePath: `/uploads/${req.file.filename}`, classes: cls, sections: secs, start: start ? new Date(start) : null, durationMinutes: durationMinutes ? Number(durationMinutes) : null, description: description || '', createdBy: req.user.sub })
    }

    // create Question docs linked to test
    const createdQuestions = []
    for (const q of questions) {
      // skip invalid/empty questions
      if (!q || !q.questionText || !String(q.questionText).trim()) continue
      const opts = Array.isArray(q.options) ? q.options.filter(o => !!String(o || '').trim()) : []
      if (!opts.length) continue
      try {
        if (!dbConnected) {
          const qdoc = { _id: makeId('q_'), testId: ts._id, questionText: String(q.questionText).trim(), options: opts, correctAnswer: q.correctAnswer || '', marks: q.marks || 1, createdAt: new Date(), updatedAt: new Date() }
          inMemoryQuestions.push(qdoc)
          createdQuestions.push(qdoc)
        } else {
          const doc = await Question.create({ testId: ts._id, questionText: String(q.questionText).trim(), options: opts, correctAnswer: q.correctAnswer || '', marks: q.marks || 1 })
          createdQuestions.push(doc)
        }
      } catch (e) {
        // skip creation errors for malformed questions
        console.warn('Skipping invalid question during bulk import:', e && e.message)
        continue
      }
    }

    return res.json({ test: ts, questionsCreated: createdQuestions.length, preview: createdQuestions.slice(0, 10) })
  } catch (e) {
    return res.status(500).json({ message: e && e.message ? e.message : String(e) })
  }
})

// Parse an uploaded .docx or .pdf and return parsed questions without creating DB records
app.post('/api/tests/parse', verifyToken, requireRole(['admin','faculty']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'file (docx/pdf) required' })
    const fp = path.join(uploadsDir, req.file.filename)
    const ext = String(path.extname(fp) || '').toLowerCase()
    let text = ''
    if (ext === '.pdf') {
      if (!pdfParse) return res.status(500).json({ message: 'Server missing dependency: pdf-parse. Run `npm install pdf-parse` in backend to support PDF parsing.' })
      const dataBuffer = fs.readFileSync(fp)
      const pdfRes = await pdfParse(dataBuffer)
      text = pdfRes && pdfRes.text ? String(pdfRes.text) : ''
    } else {
      if (!mammoth) return res.status(500).json({ message: 'Server missing dependency: mammoth. Run `npm install mammoth` in backend.' })
      const data = await mammoth.extractRawText({ path: fp })
      text = data && data.value ? String(data.value) : ''
    }
    if (!text) return res.status(400).json({ message: 'Empty or unreadable document' })

    // build blocks by detecting question-start lines (e.g. "Q1.", "1.")
    const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
    const blocks = []
    let current = []
    const questionStartRegex = /^\s*(?:Q\s*\d+\.?|\d+\.)/i
    for (const line of rawLines) {
      if (questionStartRegex.test(line) && current.length) {
        blocks.push(current.join('\n'))
        current = [line]
      } else {
        current.push(line)
      }
    }
    if (current.length) blocks.push(current.join('\n'))

    const optPrefix = /^[A-Da-d][)\.\-]\s*/
    const optionLineRegex = /^([A-Da-d]|\d+)\s*[\)\.\-]\s*(.*)$/
    // allow forms like "Correct Option : C" or "Correct Answer : Washington DC"
    const answerLineRegex = /(answer|ans|correct)(?:\s*\w*)*\s*[:\-]?\s*([A-Za-z0-9 ]+)/i
    const marksRegex = /(\d+)\s*(marks|mark|mks)/i

    const questions = []
    for (const block of blocks) {
      const lines = String(block).split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      if (!lines.length) continue

      let firstOptIdx = lines.findIndex(l => optionLineRegex.test(l) || optPrefix.test(l))
      if (firstOptIdx === -1) continue
      const qText = lines.slice(0, firstOptIdx).join(' ')
      const optionLines = []
      for (let i = firstOptIdx; i < lines.length; i++) {
        const ln = lines[i]
        if (optionLineRegex.test(ln)) {
          const m = ln.match(optionLineRegex)
          optionLines.push(m[2].trim())
        } else if (optPrefix.test(ln)) {
          optionLines.push(ln.replace(optPrefix, '').trim())
        } else {
          if (answerLineRegex.test(ln) || marksRegex.test(ln)) break
        }
      }
      if (!optionLines.length) continue

      // find answer (permissive)
      let correct = null
      const postLines = lines.slice(firstOptIdx + optionLines.length)
      for (const l of postLines) {
        let a = null
        const am = l.match(answerLineRegex)
        if (am && am[2]) a = String(am[2]).trim()
        else if (/correct/i.test(l)) {
          const m = l.match(/([A-Da-d]|\d+)\b/g)
          if (m && m.length) a = m[m.length - 1]
        }

        if (a) {
          if (/^[A-Da-d]$/.test(a)) {
            const idx = a.toUpperCase().charCodeAt(0) - 65
            if (optionLines[idx]) correct = optionLines[idx]
          } else if (/^\d+$/.test(a)) {
            const idx = Number(a) - 1
            if (optionLines[idx]) correct = optionLines[idx]
          } else {
            const found = optionLines.find(opt => opt.toLowerCase().includes(String(a).toLowerCase()))
            if (found) correct = found
          }
        }
        if (correct) break
        if (/\(correct\)|\*correct\*|\*\s*\(|\(ans\)/i.test(l)) {
          for (const opt of optionLines) {
            if (/\(correct\)|\*correct\*|\*\s*$|\(ans\)/i.test(opt)) {
              correct = opt.replace(/\(correct\)|\*correct\*|\*|\(ans\)/ig, '').trim()
              break
            }
          }
          if (correct) break
        }
      }

      // fallback: search entire block if answer not found in postLines
      if (!correct) {
        for (const l of lines) {
          let a = null
          const am = l.match(answerLineRegex)
          if (am && am[2]) a = String(am[2]).trim()
          else if (/correct/i.test(l)) {
            const m = l.match(/([A-Da-d]|\d+)\b/g)
            if (m && m.length) a = m[m.length - 1]
          }

          if (a) {
            if (/^[A-Da-d]$/.test(a)) {
              const idx = a.toUpperCase().charCodeAt(0) - 65
              if (optionLines[idx]) { correct = optionLines[idx]; break }
            } else if (/^\d+$/.test(a)) {
              const idx = Number(a) - 1
              if (optionLines[idx]) { correct = optionLines[idx]; break }
            } else {
              const found = optionLines.find(opt => opt.toLowerCase().includes(String(a).toLowerCase()))
              if (found) { correct = found; break }
            }
          }
        }
      }

      let marks = 1
      const mk = block.match(marksRegex)
      if (mk) marks = Number(mk[1]) || 1

      questions.push({ questionText: qText, options: optionLines, correctAnswer: correct, marks })
    }

    return res.json({ questions, rawText: text })
  } catch (e) {
    return res.status(500).json({ message: e && e.message ? e.message : String(e) })
  }
})

// Create multiple questions for an existing test (admin/faculty)
app.post('/api/tests/:id/questions', verifyToken, requireRole(['admin','faculty']), async (req, res) => {
  try {
    const testId = req.params.id
    const questions = req.body && req.body.questions
    if (!Array.isArray(questions) || !questions.length) return res.status(400).json({ message: 'questions array required' })

    const created = []
    if (!dbConnected) {
      for (const q of questions) {
        if (!q || !q.questionText) continue
        const opts = Array.isArray(q.options) ? q.options : []
        const optImgs = Array.isArray(q.optionImages) ? q.optionImages : []
        const qdoc = { _id: makeId('q_'), testId: testId, questionText: String(q.questionText).trim(), questionImage: q.questionImage || '', options: opts, optionImages: optImgs, correctAnswer: q.correctAnswer || '', marks: q.marks || 1, createdAt: new Date(), updatedAt: new Date() }
        inMemoryQuestions.push(qdoc)
        created.push(qdoc)
      }
    } else {
      for (const q of questions) {
        if (!q || !q.questionText) continue
        try {
          // If the client provided an _id, attempt to update the existing question
          if (q._id) {
            const existing = await Question.findById(q._id)
            if (existing) {
              // ensure we don't change the test association
              existing.questionText = String(q.questionText).trim()
              existing.questionImage = q.questionImage || ''
              existing.options = Array.isArray(q.options) ? q.options : []
              existing.optionImages = Array.isArray(q.optionImages) ? q.optionImages : []
              existing.correctAnswer = q.correctAnswer || ''
              existing.marks = Number(q.marks || 1)
              await existing.save()
              created.push(existing)
              continue
            }
            // fallthrough: if _id provided but not found, create new
          }

          const payload = {
            testId: testId,
            questionText: String(q.questionText).trim(),
            questionImage: q.questionImage || '',
            options: Array.isArray(q.options) ? q.options : [],
            optionImages: Array.isArray(q.optionImages) ? q.optionImages : [],
            correctAnswer: q.correctAnswer || '',
            marks: q.marks || 1
          }
          const doc = await Question.create(payload)
          created.push(doc)
        } catch (e) { /* skip invalid entries */ }
      }
    }

    return res.json({ created: created.length, preview: created.slice(0, 10) })
  } catch (e) {
    return res.status(500).json({ message: e && e.message ? e.message : String(e) })
  }
})

// serve frontend static build if present (optional)
const frontendDist = FRONTEND_DIST
app.use(express.static(frontendDist))
// SSE endpoint for admin notifications
app.get('/api/notifications/stream', (req, res) => {
  // Allow token via query param for EventSource connections: ?token=...
  const token = req.query && (req.query.token || req.query.access_token)
  try {
    const authHeader = req.headers && req.headers.authorization
    const provided = token ? `Bearer ${token}` : authHeader
    if (!provided) return res.status(401).json({ message: 'Unauthorized' })
    const secret = process.env.JWT_SECRET || 'change-this-secret'
    let payload = null
    try {
      const tokenOnly = provided.startsWith('Bearer ') ? provided.split(' ')[1] : provided
      payload = jwt.verify(tokenOnly, secret)
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' })
    }
    const allowed = ['admin','faculty']
    if (!payload || !allowed.includes(payload.role)) return res.status(403).json({ message: 'Forbidden' })
  } catch (e) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  // set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders && res.flushHeaders()
  // add to clients
  sseClients.add(res)
  // send an initial comment to establish the stream
  res.write(`: connected\n\n`)
  req.on('close', () => {
    sseClients.delete(res)
  })
})
// Gallery image management (top-level routes)

try {
  const Gallery = require('./models/Gallery')

  // Add images to an existing gallery
  app.post('/api/gallery/:id/images', verifyToken, requireRole('admin'), upload.array('images', 100), async (req, res) => {
    if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
    try {
      const id = req.params && req.params.id
      if (!id) return res.status(400).json({ message: 'id required' })
      const gallery = await Gallery.findById(id).catch(() => null)
      if (!gallery) return res.status(404).json({ message: 'Gallery not found' })
      const files = req.files || []
      const images = (files || []).map(f => ({ filename: f.filename, originalname: f.originalname, url: `/uploads/${f.filename}` }))
      gallery.images = gallery.images || []
      gallery.images.push(...images)
      await gallery.save()
      return res.json(gallery)
    } catch (e) { return res.status(500).json({ message: e.message }) }
  })

  // Remove a single image from a gallery by filename (admin)
  app.delete('/api/gallery/:id/images', verifyToken, requireRole('admin'), async (req, res) => {
    if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
    try {
      const id = req.params && req.params.id
      const filename = req.query && req.query.filename
      if (!id || !filename) return res.status(400).json({ message: 'id and filename required' })
      const gallery = await Gallery.findById(id).catch(() => null)
      if (!gallery) return res.status(404).json({ message: 'Gallery not found' })
      let idx = (gallery.images || []).findIndex(im => String(im.filename) === String(filename) || String(im.url || '').endsWith(String(filename)))
      if (idx === -1) {
        // fallback: try substring match (looser) and url-decoded filename
        const decoded = (() => { try { return decodeURIComponent(filename) } catch (e) { return filename } })()
        idx = (gallery.images || []).findIndex(im => (im.filename && String(im.filename).includes(filename)) || (im.url && String(im.url).includes(filename)) || (im.filename && String(im.filename).includes(decoded)) || (im.url && String(im.url).includes(decoded)))
      }
      if (idx === -1) return res.status(404).json({ message: 'Image not found in gallery' })
      const im = gallery.images[idx]
      gallery.images.splice(idx, 1)
      await gallery.save()
      // unlink file if exists
      try {
        if (im && im.filename) {
          const p = path.join(uploadsDir, String(im.filename))
          fs.unlinkSync(p)
        }
      } catch (e) { console.warn('Failed to unlink gallery image', e && e.message) }
      return res.json({ ok: true })
    } catch (e) { return res.status(500).json({ message: e.message }) }
  })
} catch (e) { console.warn('Failed to register gallery image routes', e && e.message) }

// Classes management endpoints
// Basic CRUD for admin UI. Uses `Class` model to store class names and subjects.
app.get('/api/classes', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await ClassModel.find({}).sort({ name: 1 }).lean()
    return res.json(list)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.get('/api/classes/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const cls = await ClassModel.findById(req.params.id).lean()
    if (!cls) return res.status(404).json({ message: 'Class not found' })
    return res.json(cls)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.post('/api/classes', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { name } = req.body || {}
    if (!name || !String(name).trim()) return res.status(400).json({ message: 'name required' })
    const existing = await ClassModel.findOne({ name: String(name).trim() })
    if (existing) return res.status(409).json({ message: 'Class already exists' })
    const created = await ClassModel.create({ name: String(name).trim(), subjects: [] })
    return res.status(201).json(created)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.post('/api/classes/:id/subjects', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { subject } = req.body || {}
    if (!subject || !String(subject).trim()) return res.status(400).json({ message: 'subject required' })
    const cls = await ClassModel.findById(req.params.id)
    if (!cls) return res.status(404).json({ message: 'Class not found' })
    if (!Array.isArray(cls.subjects)) cls.subjects = []
    if (cls.subjects.includes(String(subject).trim())) return res.status(409).json({ message: 'Subject already exists' })
    cls.subjects.push(String(subject).trim())
    await cls.save()
    return res.json(cls)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.delete('/api/classes/:id/subjects/:subject', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const subjectParam = decodeURIComponent(req.params.subject || '')
    const cls = await ClassModel.findById(req.params.id)
    if (!cls) return res.status(404).json({ message: 'Class not found' })
    cls.subjects = (cls.subjects || []).filter(s => s !== subjectParam)
    await cls.save()
    return res.json({ message: 'Subject removed' })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.delete('/api/classes/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const cls = await ClassModel.findById(req.params.id)
    if (!cls) return res.status(404).json({ message: 'Class not found' })
    await cls.deleteOne()
    return res.json({ message: 'Class deleted' })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// Admit card routes are registered from `routes/admitcards.js` to avoid duplication.
// ======= Assignments and Submissions (student/faculty/admin) ========
// Provides basic assignment CRUD and student submission endpoints.
try {
  // List assignments (students, faculty, admin can access)
  app.get('/api/assignments', verifyToken, async (req, res) => {
    try {
      const q = {}
      const { class: cls, section } = req.query || {}
      if (cls) q.class = String(cls)
      if (section) q.section = String(section)
      const items = await Assignment.find(q).sort({ createdAt: -1 }).lean().catch(() => [])
      return res.json(items)
    } catch (e) { return res.status(500).json({ message: e.message }) }
  })

  // Create assignment (faculty or admin)
  app.post('/api/assignments', verifyToken, requireRole(['admin','faculty']), upload.single('file'), async (req, res) => {
    try {
      if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
      const body = req.body || {}
      if (!body.title || !body.class) return res.status(400).json({ message: 'title and class required' })
      const file = req.file
      const filePath = file ? `/uploads/${file.filename}` : ''
      const doc = await Assignment.create({
        title: String(body.title || ''),
        description: String(body.description || ''),
        subject: String(body.subject || ''),
        class: String(body.class || ''),
        section: body.section || 'ALL',
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        filePath,
        createdBy: req.user && req.user.sub
      })
      return res.status(201).json(doc)
    } catch (e) { return res.status(500).json({ message: e.message }) }
  })

  // Student: submit an assignment (optional file)
  app.post('/api/assignments/:id/submit', verifyToken, requireRole('student'), upload.single('file'), async (req, res) => {
    try {
      if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
      const aid = req.params.id
      const assignment = await Assignment.findById(aid).lean().catch(() => null)
      if (!assignment) return res.status(404).json({ message: 'Assignment not found' })
      // resolve student record from authenticated user
      const username = req.user && req.user.username
      const studentRec = await Student.findOne({ email: username }).lean().catch(() => null)
      const file = req.file
      const filePath = file ? `/uploads/${file.filename}` : (req.body && req.body.filePath ? String(req.body.filePath) : '')
      const sub = await Submission.create({
        assignmentId: aid,
        studentId: studentRec ? studentRec._id : undefined,
        studentName: studentRec ? studentRec.name : (req.body && req.body.studentName) || '',
        studentRoll: studentRec ? studentRec.rollNo : (req.body && req.body.studentRoll) || '',
        studentClass: studentRec ? studentRec.class : (req.body && req.body.studentClass) || '',
        studentEmail: username || (req.body && req.body.studentEmail) || '',
        answerText: req.body && req.body.answerText ? String(req.body.answerText) : '',
        filePath,
        submittedAt: new Date()
      })
      return res.status(201).json(sub)
    } catch (e) { return res.status(500).json({ message: e.message }) }
  })

  // List submissions for an assignment. Faculty/admin see all, student sees only their own, parent must specify studentId
  app.get('/api/assignments/:id/submissions', verifyToken, async (req, res) => {
    try {
      if (!dbConnected) return res.status(503).json({ message: 'Database not available' })
      const aid = req.params.id
      const role = req.user && req.user.role
      const username = req.user && req.user.username
      const q = { assignmentId: aid }
      if (role === 'student') {
        // student may only see their own submissions
        q.studentEmail = username
      } else if (role === 'parent') {
        const { studentId } = req.query || {}
        if (!studentId) return res.status(400).json({ message: 'studentId required for parent' })
        // ensure parent linked to this student
        const user = await User.findById(req.user.sub).lean().catch(() => null)
        if (!user || user.role !== 'parent') return res.status(403).json({ message: 'Unauthorized' })
        const allowed = Array.isArray(user.parentOf) && user.parentOf.some(x => String(x) === String(studentId))
        if (!allowed) return res.status(403).json({ message: 'Not linked to this student' })
        q.studentId = studentId
      } else {
        // admin/faculty: no extra filter
      }
      const subs = await Submission.find(q).sort({ createdAt: -1 }).lean().catch(() => [])
      return res.json(subs)
    } catch (e) { return res.status(500).json({ message: e.message }) }
  })
} catch (e) { console.warn('Failed to register assignment routes', e && e.message) }

app.get('*', (req, res, next) => {
  // if path matches API, skip
  if (req.path.startsWith('/api')) return next()
  // otherwise try to send frontend index if it exists
  // Resolve an absolute path and ensure the file exists before calling res.sendFile
  try {
    const indexHtml = path.resolve(FRONTEND_DIST || '', 'index.html')
    if (fs.existsSync(indexHtml)) {
      return res.sendFile(indexHtml)
    }
  } catch (e) {
    console.warn('Error resolving FRONTEND_DIST index file:', e && e.message)
  }
  return res.status(404).json({ message: 'Not found' })
})


// ===================== Front Office APIs =====================
app.post('/api/front-office', verifyToken, requireRole(['admin', 'faculty', 'staff']), async (req, res) => {
  try {
    const payload = req.body || {}
    payload.createdBy = req.user && req.user.sub
    const doc = await FrontOffice.create(payload)
    return res.status(201).json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})
app.get('/api/front-office', verifyToken, requireRole(['admin', 'faculty', 'staff']), async (req, res) => {
  try {
    const list = await FrontOffice.find({}).sort({ createdAt: -1 }).lean().catch(() => [])
    return res.json(list)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// ===================== Admission Enquiry APIs =====================
app.post('/api/admission-enquiry', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const payload = req.body || {}
    payload.createdBy = req.user && req.user.sub
    const doc = await AdmissionEnquiry.create(payload)
    return res.status(201).json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})
app.get('/api/admission-enquiry', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await AdmissionEnquiry.find({}).sort({ createdAt: -1 }).lean().catch(() => [])
    return res.json(list)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})
app.patch('/api/admission-enquiry/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const id = req.params.id
    const payload = req.body || {}
    const allowed = ['status', 'notes']
    const update = {}
    for (const k of allowed) { if (payload[k] !== undefined) update[k] = payload[k] }
    const doc = await AdmissionEnquiry.findByIdAndUpdate(id, update, { new: true }).lean().catch(() => null)
    if (!doc) return res.status(404).json({ message: 'not found' })
    return res.json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// ===================== Online Admission APIs =====================
app.post('/api/online-admission', upload.single('document'), async (req, res) => {
  try {
    const payload = req.body || {}
    const required = ['studentName', 'dob', 'gender', 'address', 'parentName', 'parentPhone', 'classApplying']
    for (const k of required) { if (!payload[k]) return res.status(400).json({ message: `${k} required` }) }
    const file = req.file
    const filePath = file ? `/uploads/${file.filename}` : ''
    const doc = await OnlineAdmission.create({
      ...payload,
      documentPath: filePath
    })
    return res.status(201).json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})
app.get('/api/online-admission', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await OnlineAdmission.find({}).sort({ createdAt: -1 }).lean().catch(() => [])
    return res.json(list)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

// ===================== Discount Management APIs =====================
app.post('/api/discounts', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const payload = req.body || {}
    payload.appliedBy = req.user && req.user.sub
    if (!payload.studentId || !payload.type || payload.amount === undefined || !payload.term) {
      return res.status(400).json({ message: 'studentId, type, amount, term required' })
    }
    const doc = await Discount.create(payload)
    return res.status(201).json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})
app.get('/api/discounts', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const list = await Discount.find({}).sort({ createdAt: -1 }).lean().catch(() => [])
    return res.json(list)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})
app.delete('/api/discounts/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const id = req.params.id
    const doc = await Discount.findByIdAndDelete(id).catch(() => null)
    if (!doc) return res.status(404).json({ message: 'not found' })
    return res.json({ ok: true })
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

const server = app.listen(PORT, () => {
  console.log(`ERP backend listening on http://localhost:${PORT}`)
});

// Ensure basic classes (1..12) exist for legacy frontend expectations
(async () => {
  try {
    const existing = await ClassModel.countDocuments().catch(() => 0)
    if (!existing || existing === 0) {
      const toCreate = Array.from({ length: 12 }, (_, i) => ({ name: String(i + 1), subjects: [] }))
      await ClassModel.insertMany(toCreate)
      console.log('Seeded default classes 1..12')
    }
  } catch (e) {
    console.warn('Could not seed default classes:', e && e.message)
  }
})()

// Legacy-compatible faculty attendance endpoints used by existing frontend
app.get('/api/attendance/faculty', verifyToken, async (req, res) => {
  try {
    const { date, from, to, facultyId } = req.query || {}
    const filter = {}
    if (date) filter.date = date
    if (from && to) filter.date = { $gte: from, $lte: to }
    const list = await FacultyAttendance.find(filter).lean().catch(() => [])
    // Narrow per faculty if requested
    const narrowed = facultyId ? list.map(d => ({ ...d, records: (Array.isArray(d.records) ? d.records.filter(r => String(r.facultyId) === String(facultyId)) : []) })) : list
    return res.json(narrowed)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.post('/api/attendance/faculty', verifyToken, requireRole('admin|faculty'), async (req, res) => {
  try {
    const { date, records } = req.body || {}
    if (!date || !Array.isArray(records) || records.length === 0) return res.status(400).json({ message: 'date and records required' })
    // Try to resolve current user's mapped Faculty record for self-marking
    let currentFaculty = null
    try {
      const meUser = await User.findById(req.user.sub).lean().catch(() => null)
      if (meUser && meUser.username) {
        currentFaculty = await Faculty.findOne({ email: meUser.username }).lean().catch(() => null)
      }
    } catch {}
    let doc = await FacultyAttendance.findOne({ date }).catch(() => null)
    if (!doc) doc = await FacultyAttendance.create({ date, records: [], createdBy: req.user.sub })
    for (const rec of records) {
      // Determine faculty id: prefer provided rec.facultyId; if missing or not found, fall back to current user's mapped faculty
      let fid = rec && rec.facultyId ? rec.facultyId : (currentFaculty && currentFaculty._id)
      // If fid is still not resolved, attempt lookup by employeeId
      if (!fid && rec && rec.employeeId) {
        const byEmp = await Faculty.findOne({ employeeId: rec.employeeId }).lean().catch(() => null)
        if (byEmp) fid = byEmp._id
      }
      if (!fid) continue // skip if we cannot resolve a faculty id
      const idx = Array.isArray(doc.records) ? doc.records.findIndex(r => String(r.facultyId) === String(fid)) : -1
      const payload = { facultyId: fid, status: rec.status || 'present', markedBy: req.user.sub }
      if (idx >= 0) doc.records[idx] = payload; else doc.records.push(payload)
    }
    await doc.save()
    // Notify UIs to refresh this date (admin/faculty pages)
    try { sendSseEvent('attendance_updated', { type: 'faculty', date }) } catch (e) {}
    return res.json(doc)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})

app.get('/api/attendance/faculty/export', verifyToken, async (req, res) => {
  try {
    const { from, to, facultyId } = req.query || {}
    const filter = {}
    if (from && to) filter.date = { $gte: from, $lte: to }
    const list = await FacultyAttendance.find(filter).lean().catch(() => [])
    const rows = []
    rows.push(['Date', 'Faculty', 'EmployeeId', 'Status'])
    for (const d of list) {
      const recs = Array.isArray(d.records) ? d.records : []
      for (const r of recs) {
        if (facultyId && String(r.facultyId) !== String(facultyId)) continue
        let fac = null
        try { fac = await Faculty.findById(r.facultyId).lean().catch(() => null) } catch {}
        rows.push([d.date, fac ? fac.name : String(r.facultyId), fac ? (fac.employeeId || '') : '', r.status || ''])
      }
    }
    const csv = rows.map(row => row.map(v => String(v).replace(/"/g, '""')).map(v => /[",\n]/.test(v) ? `"${v}"` : v).join(',')).join('\n')
    const fname = `faculty_attendance_${from || 'start'}_${to || 'end'}.csv`
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`)
    return res.send(csv)
  } catch (e) { return res.status(500).json({ message: e.message }) }
})


// ===================== Excel Export APIs =====================
app.get('/api/export/attendance-excel', verifyToken, requireRole(['admin','faculty']), async (req, res) => {
  try {
    const { class: cls, section, from, to } = req.query || {};
    const q = {};
    if (cls) q.class = String(cls);
    if (section) q.section = String(section);
    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = String(from);
      if (to) q.date.$lte = String(to);
    }
    const items = await Attendance.find(q).sort({ date: 1 }).lean();
    const rows = items.map(i => ({
      Date: i.date,
      Class: i.class,
      Section: i.section || '',
      'Student ID': i.studentId,
      Status: i.status
    }));
    
    const xlsx = require('xlsx');
    const ws = xlsx.utils.json_to_sheet(rows.length ? rows : [{ Message: 'No data' }]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Attendance');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance_report.xlsx"');
    res.send(buf);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.get('/api/export/fees-excel', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { class: cls, term, status } = req.query || {};
    const q = {};
    // Depending on schema, we might filter receipts or students. We'll filter students for a comprehensive fee report.
    if (cls) q.class = String(cls);
    const students = await Student.find(q).lean();
    
    let rows = [];
    for (const st of students) {
      const fees = st.assignedFees || [];
      for (const fee of fees) {
        if (term && fee.term !== term) continue;
        const paidReceipts = await Receipt.countDocuments({ studentEmail: st.email, term: fee.term });
        const currentStatus = paidReceipts > 0 ? 'Paid' : 'Unpaid';
        if (status && currentStatus.toLowerCase() !== status.toLowerCase()) continue;
        
        rows.push({
          'Student Name': st.name,
          'Class': st.class,
          'Roll No': st.rollNo || '',
          'Term': fee.term,
          'Amount': fee.amount,
          'Status': currentStatus
        });
      }
    }
    
    const xlsx = require('xlsx');
    const ws = xlsx.utils.json_to_sheet(rows.length ? rows : [{ Message: 'No data' }]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Fees');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="fees_report.xlsx"');
    res.send(buf);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.get('/api/export/marks-excel', verifyToken, requireRole(['admin','faculty']), async (req, res) => {
  try {
    const { class: cls, examName } = req.query || {};
    const q = {};
    if (cls) q.class = String(cls);
    if (examName) q.examName = String(examName);
    
    const items = await Mark.find(q).sort({ studentId: 1 }).lean();
    const rows = items.map(i => ({
      'Student ID': i.studentId,
      'Class': i.class,
      'Exam': i.examName,
      'Subject': i.subject,
      'Marks Obtained': i.marksObtained,
      'Max Marks': i.maxMarks,
      'Grade': i.grade || ''
    }));
    
    const xlsx = require('xlsx');
    const ws = xlsx.utils.json_to_sheet(rows.length ? rows : [{ Message: 'No data' }]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Marks');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="marks_report.xlsx"');
    res.send(buf);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ===================== Twilio Notifications =====================
const twilio = require('twilio');
const NotificationSettings = require('./models/NotificationSettings');

let twilioClient;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('Twilio client initialized');
  } catch(e) {
    console.error('Failed to init twilio:', e.message);
  }
}

async function sendSMS(to, message) {
  if (!twilioClient || !to) return;
  try {
    // Format phone number to start with + if not already (assume India +91 for simplicity if 10 digits)
    let formattedTo = to.replace(/\D/g, '');
    if (formattedTo.length === 10) formattedTo = '+91' + formattedTo;
    else if (!formattedTo.startsWith('+')) formattedTo = '+' + formattedTo;
    
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE,
      to: formattedTo
    });
    console.log('SMS sent to', formattedTo);
  } catch (err) {
    console.error('Twilio SMS Error:', err.message);
  }
}

async function sendWhatsApp(to, message) {
  if (!twilioClient || !to) return;
  try {
    let formattedTo = to.replace(/\D/g, '');
    if (formattedTo.length === 10) formattedTo = '+91' + formattedTo;
    else if (!formattedTo.startsWith('+')) formattedTo = '+' + formattedTo;

    await twilioClient.messages.create({
      body: message,
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
      to: `whatsapp:${formattedTo}`
    });
    console.log('WhatsApp sent to', formattedTo);
  } catch (err) {
    console.error('Twilio WhatsApp Error:', err.message);
  }
}

async function notifyEvent({ event, emailOpts, phone, message }) {
  try {
    const config = await NotificationSettings.findOne({ event }).lean();
    if (!config) return; // if no config exists, we don't send SMS/WA (emails are handled by legacy logic if any)

    if (config.sms && phone) {
      await sendSMS(phone, message);
    }
    if (config.whatsapp && phone) {
      await sendWhatsApp(phone, message);
    }
    // Note: If config.email is true, the legacy email should have been sent already in the handler or we can send it here.
    // For safety, we will let existing code handle email or we can optionally send it here if emailOpts is passed.
    if (config.email && emailOpts && emailOpts.to) {
       // Only send if not already sent by legacy code. We'll pass emailOpts when we want this helper to send it.
       await sendMail(emailOpts).catch(()=>{});
    }
  } catch(e) {
    console.error('notifyEvent error:', e.message);
  }
}

app.get('/api/notification-settings', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const settings = await NotificationSettings.find().lean();
    res.json(settings);
  } catch(e) {
    res.status(500).json({ message: e.message });
  }
});

app.patch('/api/notification-settings', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const items = req.body; // array of { event, email, sms, whatsapp }
    for (const item of items) {
      await NotificationSettings.findOneAndUpdate(
        { event: item.event },
        { email: item.email, sms: item.sms, whatsapp: item.whatsapp },
        { upsert: true, new: true }
      );
    }
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ message: e.message });
  }
});

// Global error handling middleware (must be registered after all routes)
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err)
  const isProd = process.env.NODE_ENV === 'production'
  return res.status(err.status || 500).json({
    message: isProd ? 'Internal Server Error' : err.message,
    error: isProd ? {} : err
  })
})

// Graceful Shutdown implementation
const gracefulShutdown = (signal) => {
  console.log(`${signal} signal received: closing HTTP server`)
  server.close(() => {
    console.log('HTTP server closed')
    if (mongoose.connection.readyState !== 0) {
      mongoose.connection.close().then(() => {
        console.log('Mongoose connection closed')
        process.exit(0)
      }).catch((err) => {
        console.error('Error closing Mongoose connection:', err)
        process.exit(1)
      })
    } else {
      process.exit(0)
    }
  })
  // Force exit after 10 seconds if shutdown hangs
  setTimeout(() => {
    console.error('Forcing shutdown due to timeout')
    process.exit(1)
  }, 10000)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Catch unhandled rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err)
  process.exit(1)
})
