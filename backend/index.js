

// Consolidate pdfkit require in one place to avoid duplicate declarations
var PDFDocument;
try {
  PDFDocument = require('pdfkit');
} catch (e) {
  PDFDocument = null;
}
function registerTransportRoutes() {}
require('dotenv').config();
const cluster = require('cluster');
const os = require('os');
const compression = require('compression');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const adapters = require('./mongoose_to_prisma');
const prisma = require('./prisma/client');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const {
  normalizeText,
  levenshtein,
  similarity,
  enhancedSimilarity
} = require('./utils/similarity');
// Users are now seeded via Prisma instead of mock users
const {
  verifyToken,
  requireRole
} = require('./middleware/auth');
const path = require('path');
const app = express();
app.set('trust proxy', 1);
app.use(compression());
const PORT = process.env.PORT || 4000;
// Allow configuring maximum JSON/body size to avoid PayloadTooLargeError.
// Use `JSON_BODY_LIMIT` (e.g. "10mb" or numeric bytes) or fall back to
// `MAX_JSON_BODY_BYTES` for backward compatibility, otherwise default to 10mb.
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || process.env.MAX_JSON_BODY_BYTES || '10mb';
// Subjective grading configuration
const SUBJECTIVE_THRESHOLD = Number(process.env.SUBJECTIVE_THRESHOLD || 0.7);
const SUBJECTIVE_SCORING = process.env.SUBJECTIVE_SCORING || 'proportional'; // 'proportional' or 'binary'
const DEBUG_MATCH_THRESHOLD = Number(process.env.DEBUG_MATCH_THRESHOLD || 40); // percent under which to return raw block for debug

const JWT_SECRET = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production') {
  if (!JWT_SECRET || JWT_SECRET === 'change-this-secret') {
    console.error('FATAL ERROR: JWT_SECRET is missing or set to insecure default "change-this-secret" in production. Exiting process.');
    process.exit(1);
  }
}
const FRONTEND_DIST = process.env.FRONTEND_DIST || path.join(__dirname, '..', 'frontend', 'dist');
// Try to setup Razorpay if env provided (optional)
let Razorpay = null;
let razorpayClient = null;
try {
  Razorpay = require('razorpay');
} catch (e) {
  Razorpay = null;
}
if (Razorpay && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  try {
    razorpayClient = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  } catch (e) {
    razorpayClient = null;
  }
}

// Configure CORS: allow all origins dynamically to support Vercel preview URLs and dynamic domains
const corsOptions = {
  origin: true, // Reflects the incoming origin, allowing any domain
  credentials: true // Required if cookies or Authorization headers are sent
};
app.use(cors(corsOptions));
// When running behind a proxy (Render, etc.) enable trust proxy so req.ip and secure checks work correctly
app.set('trust proxy', true);

// Production-grade security headers
app.use(helmet({
  contentSecurityPolicy: false
}));
app.disable('x-powered-by');

// Request logging using morgan
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Rate Limiting setup
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // 15 minutes
  max: 300,
  // Limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: {
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  // Limit each IP to 30 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: {
    message: 'Too many login attempts from this IP, please try again after 15 minutes.'
  }
});
app.use('/api/login', authLimiter);
app.use('/api', (req, res, next) => {
  // Exclude SSE Stream endpoint to keep connections open
  if (req.path === '/notifications/stream') return next();
  return apiLimiter(req, res, next);
});

// Configure body parsers with an increased, configurable limit to prevent
// "PayloadTooLargeError: request entity too large" on large JSON payloads.
app.use(express.json({
  limit: JSON_BODY_LIMIT
}));
app.use(express.urlencoded({
  limit: JSON_BODY_LIMIT,
  extended: true
}));

// Compatibility middleware: Prisma returns { id }, but the frontend expects { _id }
// This intercepts all JSON responses and dynamically adds `_id` if `id` is present.
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(body) {
    function addUnderscoreId(obj, seen = new Set()) {
      if (!obj || typeof obj !== 'object') return;
      if (seen.has(obj)) return;
      seen.add(obj);
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) addUnderscoreId(obj[i], seen);
      } else {
        if (obj.id !== undefined && obj._id === undefined) {
          obj._id = obj.id;
        }
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            addUnderscoreId(obj[key], seen);
          }
        }
      }
    }
    if (body && typeof body === 'object') {
      addUnderscoreId(body);
    }
    return originalJson.call(this, body);
  };
  next();
});

// serve uploaded files
const uploadsDir = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Register transport routes (defined earlier) after app and middleware are initialized
try {
  registerTransportRoutes && registerTransportRoutes();
} catch (e) {
  console.warn('Failed to register transport routes', e && e.message);
}
// Register report card routes
try {} catch (e) {
  console.warn('Failed to register reportcard routes', e && e.message);
}
// Register admit card routes (modular)
try {
  const registerAdmitCardRoutes = require('./routes/admitcards');
  // provide dependencies to the module for consistency
  registerAdmitCardRoutes && registerAdmitCardRoutes(app, {
    uploadsDir,
    Student: adapters.Student,
    User: adapters.User,
    PDFDocument: PDFDocument
  });
} catch (e) {
  console.warn('Failed to register admit card routes', e && e.message);
}

// multer for file uploads (assignments/submissions)
const multer = require('multer');
const fs = require('fs');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, {
  recursive: true
});
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const name = Date.now() + '_' + file.originalname.replace(/\s+/g, '_');
    cb(null, name);
  }
});
// Allow uploads up to 1GB (useful for large video resources). Keep storage configuration.
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES) || 1024 * 1024 * 1024; // 1GB
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_BYTES
  }
});

// === Assignments & Submissions routes ===
try {} catch (e) {
  console.warn('Failed to register assignments routes', e && e.message);
}

// Contact Query endpoints (moved after multer/upload initialization)
// Public: submit a contact query (optionally attach a PDF under the configured upload limits)

// Admin: list contact queries

// Admin: update status and optionally add a note and mark notified

// Admin: update faculty fields (accept assignments, houses, role)

// Faculty dashboard - small summary for faculty (used by frontend to populate panel)

// Faculty Attendance APIs

// CSV export for faculty attendance

// Student deletion requests (admin): list and approve

// Create a report card (admin/faculty)

// List all report cards (admin)

// List report cards for current user (student)

// Parent/Admin/Student: list report cards for a specific student

// Student/Parent/Admin: rank summary for one student within class-section

// Download report card file

// Staff Attendance APIs

// CSV export for staff attendance

// Hostel Allocation APIs
// List allocations (optionally filter by studentId or hostelId)

// Create allocation

// Mark an allocation as paid (creates a receipt)

// Receipts: list my receipts

// Hostel receipts: list my hostel receipts (separate from generic receipts list)

// Admin: backfill/complete missing hostel receipts (populate rollNo/class/pdfUrl where possible)

// Delete all allocations (admin-only)

// Hostel CRUD APIs
// List all hostels

// Student: view my hostel allocations

// Public: minimal hostel list (no auth) for student display

// Create a hostel

// Update a hostel

// Delete a hostel

// try to require mammoth for docx parsing; optional dependency
let mammoth = null;
try {
  mammoth = require('mammoth');
} catch (e) {
  mammoth = null;
}
// try to require pdf-parse for PDF parsing; optional dependency
let pdfParse = null;
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  pdfParse = null;
}
// optional PDF generator for receipts
// `PDFDocument` is consolidated at the top of the file. If it's not available, try to require here.
if (!PDFDocument) {
  try {
    PDFDocument = require('pdfkit');
  } catch (e) {
    PDFDocument = null;
  }
}

// Helper: generate a simple PDF receipt and save to uploads directory. Returns { pdfPath, pdfUrl }
async function generateReceiptPdf(receipt, allocation, type = 'hostel') {
  if (!PDFDocument) return null;
  try {
    const fname = `receipt_${type}_${String(receipt._id || Date.now())}.pdf`;
    const outPath = path.join(uploadsDir, fname);
    await new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40
        });
        const outStream = fs.createWriteStream(outPath);
        outStream.on('finish', () => resolve());
        outStream.on('error', err => reject(err));
        doc.pipe(outStream);
        doc.fontSize(18).text('School Name', {
          align: 'left'
        });
        doc.moveDown();
        doc.fontSize(12).text(`Receipt ID: ${String(receipt._id || '')}`);
        doc.text(`Date: ${new Date(receipt.createdAt || Date.now()).toLocaleString()}`);
        doc.moveDown();
        doc.fontSize(12).text(`Student: ${receipt.studentName || ''}`);
        if (receipt.rollNo) doc.text(`Roll No: ${receipt.rollNo}`);
        if (receipt.class) doc.text(`Class: ${receipt.class}`);
        if (type === 'hostel' && allocation) {
          try {
            doc.moveDown();
            doc.text(`Hostel: ${allocation.hostelId || ''}`);
            doc.text(`Room: ${allocation.floorNo || ''} / ${allocation.roomNo || ''} / B${Number(allocation.bedIndex) + 1 || ''}`);
          } catch (e) {}
        }
        if (type === 'transport' && allocation) {
          try {
            doc.moveDown();
            // Prefer human-readable names saved on the receipt first, then allocation names, then IDs
            const routeName = receipt && receipt.routeName || allocation && allocation.routeName || allocation && allocation.routeId || '';
            const stopName = receipt && receipt.stopName || allocation && allocation.stopName || allocation && allocation.stopId || '';
            const busName = receipt && receipt.busName || allocation && allocation.busName || allocation && allocation.busId || '';
            doc.text(`Route: ${routeName}`);
            doc.text(`Stop: ${stopName}`);
            doc.text(`Bus: ${busName}`);
            doc.text(`Seat: ${allocation.seatNo || ''}`);
          } catch (e) {}
        }
        doc.moveDown();
        if (type === 'hostel') {
          doc.fontSize(14).text(`Term: ${receipt.term || ''}`);
        } else {
          doc.fontSize(14).text(`Transport Fee`);
        }
        doc.moveDown();
        doc.fontSize(16).text(`Amount Paid: ₹${Number(receipt.amount || 0)}`, {
          align: 'left'
        });
        doc.moveDown(2);
        if (receipt.razorpayPaymentId) doc.fontSize(10).text(`Payment ID: ${receipt.razorpayPaymentId}`);
        if (receipt.razorpayOrderId) doc.fontSize(10).text(`Order ID: ${receipt.razorpayOrderId}`);
        doc.end();
      } catch (e) {
        return reject(e);
      }
    });
    return {
      pdfPath: outPath,
      pdfUrl: `/uploads/${fname}`
    };
  } catch (e) {
    console.warn('Failed to generate PDF', e && (e.message || e));
    return null;
  }
}

// Create Razorpay order (or stub if razorpayClient not configured)

// Confirm payment: accepts razorpay ids, creates Receipt, generates PDF and updates allocation/payments

// Return current authenticated student's document
// This handler tries multiple strategies to resolve the student document:
// 1) If `req.user.sub` matches a Student _id, return that
// 2) Otherwise, try to resolve by `req.user.username` (email)
// 3) If still not found, return 404

// helper to generate short parent access codes
function generateParentCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// ===================== Test Results APIs (student & admin/faculty) =====================
// Get current authenticated student's test results

// Get test results by student id (admin/faculty)

// Set or clear a student's house role (e.g., Captain/Leader)

// Bulk change house for many students at once

// Generic file upload endpoint - returns public URL for uploaded file

// ===================== ID Card APIs =====================
// Generate ID cards for a class & section in one batch

// Generate ID cards for all faculty

// Generate ID cards for staff (users with role 'admin')

// Update an individual ID card (e.g., add/change photo or fields)

// List latest ID cards for a class and section (default latest per student)

// Get batches summary (history) by class/section

// Get cards by batch id

// Latest card for a student

// Latest card for a faculty

// Latest card for a staff user

// Backfill idCode for existing cards missing the code

// Verify ID card authenticity by code (public)

// Simple in-memory SSE clients list for admin notification stream
const sseClients = new Set();
function sendSseEvent(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch (e) {
      // ignore write errors; client cleanup will remove closed connections
    }
  }
}

// Shared Resend Mail Service
const { sendMail, sendCredentialEmail } = require('./utils/mailer');


// Debug: test mail endpoint (useful to verify mail delivery on host).
// If `DEBUG_MAIL_TOKEN` is set in env, the request must include header `X-Debug-Token: <token>`.
// WARNING: Keep this endpoint protected or remove it after testing in production.

// Protected debug endpoint to check SendGrid API and SMTP connectivity from the host.
// Requires header `X-Debug-Token: <DEBUG_MAIL_TOKEN>` when `DEBUG_MAIL_TOKEN` is set in env.

let dbConnected = false;

// In-memory fallback storage for when MongoDB is not available (helps development without DB)
const inMemoryTests = [];
const inMemoryQuestions = [];
const inMemoryTestsResults = [];
function makeId(prefix = '') {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}



// Basic health

// Resolve current user's Faculty record

// login endpoint

// register endpoint (creates user in DB if connected, otherwise in-memory)

// logout (client-side token discard helper) - responds ok so clients can clear session

// Salary payment APIs (admin and faculty)
// ===================== Faculty Salary APIs =====================
// List all faculty (minimal fields)

// Create a salary payment (mock Razorpay flow). If Razorpay env exists, we still mock success for test.

// Create Razorpay order (optional real test). Returns order payload for Checkout.

// Capture/verify payment and persist receipt. Frontend sends order/payment ids.

// List all salary payments (admin)

// Faculty: my salary payments

// Generate simple HTML receipt for a salary payment (downloadable via browser)

// PDF receipt (application/pdf). Requires pdfkit installed; otherwise returns 501.

// ===================== Staff Salary APIs (admin) =====================
// List all staff users (minimal fields)

// Create a staff salary payment (mock Razorpay flow)

// Generate a pending staff salary slip for tracking before payment

// Mark an existing staff salary slip as paid

// Create Razorpay order for staff salary

// Confirm staff salary payment and persist receipt

// List all staff salary payments

// Staff: my staff salary payments

// Generate HTML receipt for staff salary payment (admin or owning staff)

// Staff/Admin: PDF receipt for staff salary payment

// Faculty registration endpoint (public) - stores registration for admin approval

// Student registration (public) -> admin approval

// Admin: list student registrations

// Faculty/Admin: list students by class/section

// NOTE: Student route consolidated earlier. Removed duplicate handler to avoid
// multiple handlers for the same path which can produce unexpected behavior.

// Student: get or generate parent access code for the logged-in student

// Attendance endpoints

// Export student attendance history as CSV

// Faculty attendance endpoints

// Export faculty attendance history as CSV

// Marks endpoints (basic create/update/list)

// Bulk upsert marks: accepts array of marks

// Return marks for the logged-in student (or parent with studentId query)

// Faculty: lesson planning management

function mapBehaviorRecord(record) {
  if (!record) return record;
  return {
    ...record,
    typeLabel: record.type === 'incident' ? 'Incident' : record.type === 'counseling' ? 'Counseling Log' : 'Remark'
  };
}
async function ensureParentLinked(parentUserId, studentId) {
  const parent = await prisma.user.findUnique({ where: { id: String(parentUserId) } }).catch(() => null);
  return !!(parent && parent.role === 'parent' && Array.isArray(parent.parentOf) && parent.parentOf.some(x => String(x) === String(studentId)));
}

// Behavior records: incidents, remarks, and counseling logs

function escapeExcelCell(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function safeSheetName(name) {
  return String(name || 'Report').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Report';
}
function buildExcelCell(value, styleId) {
  return `<Cell${styleId ? ` ss:StyleID="${styleId}"` : ''}><Data ss:Type="String">${escapeExcelCell(value)}</Data></Cell>`;
}
function buildWorksheet(sheetName, title, rows) {
  const normalizedRows = rows && rows.length > 1 ? rows : [...(rows && rows.length ? rows : [['Report']]), ['No records found for the selected filters.']];
  const safeTitle = escapeExcelCell(title || 'Report');
  const colCount = Math.max(...(normalizedRows || [[]]).map(row => row.length || 1), 1);
  const generatedAt = new Date().toLocaleString('en-IN');
  const columns = Array.from({
    length: colCount
  }, (_, index) => {
    const header = String((normalizedRows[0] || [])[index] || '').toLowerCase();
    let width = 95;
    if (header.includes('student name') || header.includes('email')) width = 170;
    if (header.includes('student id') || header.includes('receipt')) width = 150;
    if (header.includes('amount') || header.includes('percentage')) width = 110;
    return `<Column ss:AutoFitWidth="0" ss:Width="${width}"/>`;
  }).join('');
  const bodyRows = normalizedRows.map((row, index) => {
    const isHeader = index === 0;
    const isEmpty = row.length === 1 && String(row[0] || '').startsWith('No records found');
    if (isEmpty) {
      return `<Row ss:Height="24"><Cell ss:MergeAcross="${Math.max(colCount - 1, 0)}" ss:StyleID="Empty"><Data ss:Type="String">${escapeExcelCell(row[0])}</Data></Cell></Row>`;
    }
    const cells = Array.from({
      length: colCount
    }, (_, cellIndex) => buildExcelCell(row[cellIndex] || '', isHeader ? 'Header' : 'Body')).join('');
    return `<Row>${cells}</Row>`;
  }).join('');
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
</Worksheet>`;
}
function buildExcelWorkbook(title, sheets) {
  const workbookSheets = Array.isArray(sheets) && sheets.length ? sheets : [{
    name: title,
    title,
    rows: [['Report'], ['No records found for the selected filters.']]
  }];
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
</Workbook>`;
}
function sendExcel(res, title, rows, filename) {
  const body = buildExcelWorkbook(title, [{
    name: title,
    title,
    rows
  }]);
  res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(body);
}
function sendExcelSheets(res, sheets, filename) {
  const body = buildExcelWorkbook(filename.replace(/\.xls$/i, ''), sheets);
  res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(body);
}
function reportDateFilter(from, to) {
  if (!from && !to) return null;
  const filter = {};
  if (from) filter.$gte = String(from);
  if (to) filter.$lte = String(to);
  return filter;
}
function reportCreatedAtFilter(from, to) {
  if (!from && !to) return null;
  const filter = {};
  if (from) {
    const start = new Date(String(from));
    start.setHours(0, 0, 0, 0);
    filter.$gte = start;
  }
  if (to) {
    const end = new Date(String(to));
    end.setHours(23, 59, 59, 999);
    filter.$lte = end;
  }
  return filter;
}
function addEmptyReportRow(rows) {
  if (rows.length === 1) {
    rows.push(['No records found for the selected filters.']);
  }
  return rows;
}
function termVariants(term) {
  const raw = String(term || '').trim();
  if (!raw) return [];
  const compact = raw.replace(/\s+/g, '');
  const spaced = compact.replace(/^Term(\d)$/i, 'Term $1');
  return Array.from(new Set([raw, compact, spaced]));
}
async function buildAttendanceReportRows(query) {
  const {
    class: cls,
    section,
    studentId,
    from,
    to
  } = query || {};
  const q = {};
  if (cls) q.class = String(cls);
  if (section) q.section = String(section);
  const dateFilter = reportDateFilter(from, to);
  if (dateFilter) q.date = dateFilter;
  const items = await prisma.attendance.findMany({ 
    where: q,
    orderBy: { date: 'asc' }
  });
  const ids = new Set();
  (items || []).forEach(item => {
    ;
    (item.records || []).forEach(record => {
      if (!studentId || String(record.studentId) === String(studentId)) ids.add(String(record.studentId));
    });
  });
  const students = ids.size ? await Student.find({
    _id: {
      $in: Array.from(ids)
    }
  }) : [];
  const byId = {};
  (students || []).forEach(student => {
    byId[String(student._id)] = student;
  });
  const rows = [['Date', 'Class', 'Section', 'Student ID', 'Student Name', 'Roll No', 'Status']];
  (items || []).forEach(item => {
    ;
    (item.records || []).forEach(record => {
      if (studentId && String(record.studentId) !== String(studentId)) return;
      const student = byId[String(record.studentId)] || {};
      rows.push([item.date || '', item.class || '', item.section || '', record.studentId || '', student.name || '', student.rollNo || '', record.status || '']);
    });
  });
  return addEmptyReportRow(rows);
}
async function buildFeesReportRows(query) {
  const {
    class: cls,
    section,
    studentId,
    from,
    to,
    term,
    paymentStatus
  } = query || {};
  const studentsQuery = {};
  if (cls) studentsQuery.class = String(cls);
  if (section) studentsQuery.section = String(section);
  if (studentId) studentsQuery._id = studentId;
  const students = await prisma.student.findMany({ 
    where: studentsQuery,
    orderBy: [
      { class: 'asc' },
      { section: 'asc' },
      { rollNo: 'asc' },
      { name: 'asc' }
    ]
  });
  const studentIds = students.map(s => String(s._id));
  const receiptQuery = {};
  if (studentIds.length) receiptQuery.studentId = {
    $in: studentIds
  };
  if (term) receiptQuery.term = {
    $in: termVariants(term)
  };
  const createdAtFilter = reportCreatedAtFilter(from, to);
  if (createdAtFilter) receiptQuery.createdAt = createdAtFilter;
  const receipts = await prisma.receipt.findMany({ 
    where: receiptQuery,
    orderBy: { createdAt: 'desc' }
  });
  const paidKeys = new Set();
  (receipts || []).forEach(r => paidKeys.add(`${String(r.studentId || '')}|${String(r.term || '')}`));
  const receiptByKey = {};
  (receipts || []).forEach(r => {
    const key = `${String(r.studentId || '')}|${String(r.term || '')}`;
    if (!receiptByKey[key]) receiptByKey[key] = [];
    receiptByKey[key].push(r);
  });
  const rows = [['Student ID', 'Student Name', 'Email', 'Class', 'Section', 'Roll No', 'Term', 'Assigned Amount', 'Paid Amount', 'Status', 'Paid On', 'Receipt ID']];
  (students || []).forEach(student => {
    const allowedTerms = termVariants(term);
    const assignedFees = (student.assignedFees || []).filter(fee => !term || allowedTerms.includes(String(fee.term || '')));
    const feeRows = assignedFees.length ? assignedFees : [{
      term: term || '',
      amount: ''
    }];
    feeRows.forEach(fee => {
      const key = `${String(student._id)}|${String(fee.term || '')}`;
      const recs = receiptByKey[key] || [];
      const paidAmount = recs.reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const status = paidKeys.has(key) || paidAmount > 0 ? 'Paid' : 'Pending';
      if (paymentStatus === 'paid' && status !== 'Paid') return;
      if (paymentStatus === 'pending' && status !== 'Pending') return;
      rows.push([student._id || '', student.name || '', student.email || '', student.class || '', student.section || '', student.rollNo || '', fee.term || '', fee.amount || '', paidAmount || '', status, recs[0] && recs[0].createdAt ? new Date(recs[0].createdAt).toLocaleDateString('en-IN') : '', recs[0] && recs[0]._id ? recs[0]._id : '']);
    });
  });
  return addEmptyReportRow(rows);
}
async function buildMarksReportRows(query) {
  const {
    class: cls,
    section,
    studentId,
    subject,
    term,
    from,
    to
  } = query || {};
  const q = {};
  if (cls) q.class = String(cls);
  if (section) q.section = String(section);
  if (studentId) q.studentId = studentId;
  if (subject) q.subject = new RegExp(String(subject), 'i');
  if (term) q.term = {
    $in: termVariants(term)
  };
  const createdAtFilter = reportCreatedAtFilter(from, to);
  if (createdAtFilter) q.createdAt = createdAtFilter;
  const marks = await prisma.mark.findMany({ 
    where: q,
    orderBy: [
      { class: 'asc' },
      { section: 'asc' },
      { subject: 'asc' },
      { createdAt: 'desc' }
    ]
  });
  const ids = Array.from(new Set((marks || []).map(m => String(m.studentId)).filter(Boolean)));
  const students = ids.length ? await Student.find({
    _id: {
      $in: ids
    }
  }) : [];
  const byId = {};
  (students || []).forEach(student => {
    byId[String(student._id)] = student;
  });
  const rows = [['Class', 'Section', 'Student ID', 'Student Name', 'Roll No', 'Subject', 'Term', 'Obtained', 'Total', 'Percentage', 'Recorded On']];
  (marks || []).forEach(mark => {
    const student = byId[String(mark.studentId)] || {};
    const total = Number(mark.total || 0);
    const obtained = Number(mark.obtained || 0);
    rows.push([mark.class || '', mark.section || '', mark.studentId || '', student.name || '', student.rollNo || '', mark.subject || '', mark.term || '', obtained, total, total ? `${Math.round(obtained / total * 10000) / 100}%` : '', mark.createdAt ? new Date(mark.createdAt).toLocaleDateString('en-IN') : '']);
  });
  return addEmptyReportRow(rows);
}

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
};
const CLASS_NUMBER_TO_ROMAN = Object.fromEntries(Object.entries(CLASS_ROMAN_TO_NUMBER).map(([roman, number]) => [number, roman]));
function classAliases(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const upper = raw.toUpperCase();
  return Array.from(new Set([raw, upper, CLASS_ROMAN_TO_NUMBER[upper], CLASS_NUMBER_TO_ROMAN[raw]].filter(Boolean)));
}

// Get fee structure (admin) - returns all class+section entries

// Public: get fee for a class/section (authenticated users)

// Set or update fee for a class+section (creates history entry)

// Delete a specific history entry for a fee-structure (admin)

// Admin: list receipts

// Student: get their receipts

// NOTE: Student route consolidated earlier. Removed duplicate handler to avoid
// multiple handlers for the same path which can produce unexpected behavior.

// Create Razorpay order (requires RAZORPAY_KEY_ID and SECRET in env)

// Debug: report whether Razorpay env vars are present (development helper - does not return secrets)

// Assign a fee to students in a class/section (admin)

// Confirm payment (verify signature) and create Receipt

// admin-only route example

// Complaints

// Events

// Meetings
// Admin can create meetings targeted to students (all / class / section / specific student)

// Admin: list meetings

// My meetings - for students (and generic for other roles)

// Students - list/filter (admin or faculty)

// Admin: create student directly (auto-assign section and rollNo, create login user and email credentials)

// Create an assignment (faculty)

// List assignments (students and faculty). Query by class and section.

// Test Management
// Create a test series (admin or faculty). Supports optional file upload (e.g., CSV or resources)

// Admin: list all tests

// Update a test series (admin or faculty). Faculty may only update tests they created.

// Delete a test series (admin or faculty who created it)

// Get tests relevant to the requesting user (faculty/admin see created or all, students see assigned)

// Get results for a test (admin or faculty)

// Subjective review routes removed (feature deleted)

// Return questions for a test - allow student, admin and faculty (do not expose correct answers to students)
// Admins/faculty can also fetch questions for management purposes; correct answers are not included here.

// Student submits answers for a test; server grades and stores a TestResult

// Student forfeits test (e.g., leaves tab/window) — create a zero-score TestResult

// Upload bulk results as CSV and import into TestResult docs (admin/faculty)

// Parent/Admin: get test results for a specific student

// Student: submit an assignment answer (file optional)

// Leaves: student apply for leave

// Get leaves: admins see all, others see their own

// Get my leaves (explicit)

// Update leave status (admin only) - accept optional note

// Admin: upload syllabus for a class/section

// Admin: create a notice (target one or more roles)
// Admin: create a notice (target one or more roles) - supports optional PDF upload and student filters

// Get notices: admin can optionally filter by role via ?role=student|faculty|parent

// Public: get syllabus for a class and section (match specific section or ALL)

// Admin: delete a syllabus entry (and its uploaded file)

// Faculty: upload a resource (PDF) for students
// Allow faculty and admin to upload resources (admin can upload forms)

// Authenticated: list resources (students and faculty)

// Faculty/Admin: delete a resource. Faculty can delete only their own uploads.

// Public: list uploaded forms/resources for download (used on Start page)

// Admin: custom form builder

// Public: submit a form query for a given uploaded form (optional attachment)

// Public: submit a built custom form

// Public: submit a contact query (from Start page contact button)

// Admin: list submitted contact queries

// Admin: update status of a contact query and optionally notify

// Admin: list submitted form queries

// Admin: compute student rank analytics by class/section

// Gallery endpoints: Admin can create gallery entries (label + multiple images). Public can list.
try {

  // Create gallery item (admin only)

  // List gallery items (public)

  // Delete a gallery item (admin)
} catch (e) {
  console.warn('Failed to register gallery routes', e && e.message);
}

// Faculty: list resources uploaded by the current faculty member

// (timetable endpoints implemented later — keep single richer implementation)

// Admin helper: regenerate PDFs for timetables that have `content` but no `filePath`.
// Useful after installing pdfkit if earlier saves didn't create PDFs.

// Regenerate PDF for a single timetable id

// Faculty: list submissions for an assignment

// Faculty: extend due date (edit assignment)

// Admin: delete a student (remove student record and associated user, notify student)

// Admin: update a student's class/section/roll/name and optional demographics

// Faculty: change a student's class (assign new section & roll no automatically)

// Faculty: set a student's stream (only permitted for faculty role)

// Faculty: block/unblock student (faculty-initiated)

// Faculty: create a delete request for a student (goes to admin approvals)

// Admin: list delete requests

// Admin: approve a delete request (deletes student and user)

// Admin: block/unblock a student's login account (by student id)

// Faculty management: list, update, delete (admin only)

// Admin: block or unblock a faculty's user account (by faculty id)

// Syllabus

// Timetable endpoints - allow admin to upload a timetable (file or JSON content)

// Query timetables for a class/section. Returns history (newest-first).

// Leaves

// Certificates: admin can generate/send certificates; users can list their certificates

// Admin: create/generate a certificate (multipart: optional signature image + optional uploaded file)

// List certificates (admin)

// List my certificates (recipient)

// Messages (Parent -> Admin)

// Faculty: request deletion of a student (creates a DeletionRequest)

// Admin: list deletion requests

// Admin: approve a deletion request (deletes the student and associated user)

// Bulk test creation from a .docx file (parses questions/options/answers/marks)

// Parse an uploaded .docx or .pdf and return parsed questions without creating DB records

// Create multiple questions for an existing test (admin/faculty)

// serve frontend static build if present (optional)
const frontendDist = FRONTEND_DIST;
app.use(express.static(frontendDist));
// SSE endpoint for admin notifications

// Gallery image management (top-level routes)

try {

  // Add images to an existing gallery

  // Remove a single image from a gallery by filename (admin)
} catch (e) {
  console.warn('Failed to register gallery image routes', e && e.message);
}

// Classes management endpoints
// Basic CRUD for admin UI. Uses `Class` model to store class names and subjects.

// Admit card routes are registered from `routes/admitcards.js` to avoid duplication.
// ======= Assignments and Submissions (student/faculty/admin) ========
// Provides basic assignment CRUD and student submission endpoints.
try {} catch (e) {
  console.warn('Failed to register assignment routes', e && e.message);
}
app.get('*', (req, res, next) => {
  // if path matches API, skip
  if (req.path.startsWith('/api')) return next();
  // otherwise try to send frontend index if it exists
  // Resolve an absolute path and ensure the file exists before calling res.sendFile
  try {
    const indexHtml = path.resolve(FRONTEND_DIST || '', 'index.html');
    if (fs.existsSync(indexHtml)) {
      return res.sendFile(indexHtml);
    }
  } catch (e) {
    console.warn('Error resolving FRONTEND_DIST index file:', e && e.message);
  }
  return res.status(404).json({
    message: 'Not found'
  });
});

// ===================== Front Office APIs =====================

// ===================== Admission Enquiry APIs =====================

// ===================== Online Admission APIs =====================

// ===================== Discount Management APIs =====================



const helpers = {
    ...adapters,
    prisma,
    sendMail: typeof sendMail !== 'undefined' ? sendMail : async () => ({ sent: false }),
    notifyEvent: typeof notifyEvent !== 'undefined' ? notifyEvent : (typeof sendSseEvent !== 'undefined' ? sendSseEvent : async () => {}),
    verifyToken: typeof verifyToken !== 'undefined' ? verifyToken : null,
    requireRole: typeof requireRole !== 'undefined' ? requireRole : null,
    generateReceiptPdf: typeof generateReceiptPdf !== 'undefined' ? generateReceiptPdf : null,
    generateReportCardPdf: typeof generateReportCardPdf !== 'undefined' ? generateReportCardPdf : null,
    generateAdmitCardPdf: typeof generateAdmitCardPdf !== 'undefined' ? generateAdmitCardPdf : null,
    generateIDCardPdf: typeof generateIDCardPdf !== 'undefined' ? generateIDCardPdf : null,
    generateHostelReceiptPdf: typeof generateHostelReceiptPdf !== 'undefined' ? generateHostelReceiptPdf : null,
    generateSalaryReceiptPdf: typeof generateSalaryReceiptPdf !== 'undefined' ? generateSalaryReceiptPdf : null,
    generateCertificatePdf: typeof generateCertificatePdf !== 'undefined' ? generateCertificatePdf : null,
    upload: typeof upload !== 'undefined' ? upload : null,
    transporter: typeof transporter !== 'undefined' ? transporter : null,
    similarity: typeof similarity !== 'undefined' ? similarity : null,
    PDFDocument: typeof PDFDocument !== 'undefined' ? PDFDocument : null,
    fs: typeof fs !== 'undefined' ? fs : require('fs'),
    path: typeof path !== 'undefined' ? path : require('path'),
    bcrypt: typeof bcrypt !== 'undefined' ? bcrypt : require('bcryptjs'),
    jwt: typeof jwt !== 'undefined' ? jwt : require('jsonwebtoken'),
    sendMail,
    sendCredentialEmail
};

const transportRoutes = require('./routes/transportRoutes')(helpers);
app.use('/api/transport', transportRoutes);
const reportcardsRoutes = require('./routes/reportcardsRoutes')(helpers);
app.use('/api/reportcards', reportcardsRoutes);
const assignmentsRoutes = require('./routes/assignmentsRoutes')(helpers);
app.use('/api/assignments', assignmentsRoutes);
const contact_queryRoutes = require('./routes/contact-queryRoutes')(helpers);
app.use('/api/contact-query', contact_queryRoutes);
const adminRoutes = require('./routes/adminRoutes')(helpers);
app.use('/api/admin', adminRoutes);
const facultyRoutes = require('./routes/facultyRoutes')(helpers);
app.use('/api/faculty', facultyRoutes);
const faculty_attendanceRoutes = require('./routes/faculty-attendanceRoutes')(helpers);
app.use('/api/faculty-attendance', faculty_attendanceRoutes);
const attendanceRoutes = require('./routes/attendanceRoutes')(helpers);
app.use('/api/attendance', attendanceRoutes);
const studentsRoutes = require('./routes/studentsRoutes')(helpers);
app.use('/api/students', studentsRoutes);
const progressRoutes = require('./routes/progressRoutes')(helpers);
app.use('/api/progress', progressRoutes);
const hostelRoutes = require('./routes/hostelRoutes')(helpers);
app.use('/api/hostel', hostelRoutes);
const receiptsRoutes = require('./routes/receiptsRoutes')(helpers);
app.use('/api/receipts', receiptsRoutes);
const hostelsRoutes = require('./routes/hostelsRoutes')(helpers);
app.use('/api/hostels', hostelsRoutes);
const paymentsRoutes = require('./routes/paymentsRoutes')(helpers);
app.use('/api/payments', paymentsRoutes);
const testsRoutes = require('./routes/testsRoutes')(helpers);
app.use('/api/tests', testsRoutes);
const uploadRoutes = require('./routes/uploadRoutes')(helpers);
app.use('/api/upload', uploadRoutes);
const idcardsRoutes = require('./routes/idcardsRoutes')(helpers);
app.use('/api/idcards', idcardsRoutes);
const debugRoutes = require('./routes/debugRoutes')(helpers);
app.use('/api/debug', debugRoutes);
const healthRoutes = require('./routes/healthRoutes')(helpers);
app.use('/api/health', healthRoutes);
const loginRoutes = require('./routes/loginRoutes')(helpers);
app.use('/api/login', loginRoutes);
const registerRoutes = require('./routes/registerRoutes')(helpers);
app.use('/api/register', registerRoutes);
const logoutRoutes = require('./routes/logoutRoutes')(helpers);
app.use('/api/logout', logoutRoutes);
const salaryRoutes = require('./routes/salaryRoutes')(helpers);
app.use('/api/salary', salaryRoutes);
const staff_salaryRoutes = require('./routes/staff-salaryRoutes')(helpers);
app.use('/api/staff-salary', staff_salaryRoutes);
const marksRoutes = require('./routes/marksRoutes')(helpers);
app.use('/api/marks', marksRoutes);
const behavior_recordsRoutes = require('./routes/behavior-recordsRoutes')(helpers);
app.use('/api/behavior-records', behavior_recordsRoutes);
const reportsRoutes = require('./routes/reportsRoutes')(helpers);
app.use('/api/reports', reportsRoutes);
const adminsRoutes = require('./routes/adminsRoutes')(helpers);
app.use('/api/admins', adminsRoutes);
const staffRoutes = require('./routes/staffRoutes')(helpers);
app.use('/api/staff', staffRoutes);
const hrRoutes = require('./routes/hrRoutes')(helpers);
app.use('/api/hr', hrRoutes);
const parentsRoutes = require('./routes/parentsRoutes')(helpers);
app.use('/api/parents', parentsRoutes);
const financeRoutes = require('./routes/financeRoutes')(helpers);
app.use('/api/finance', financeRoutes);
const profileRoutes = require('./routes/profileRoutes')(helpers);
app.use('/api/profile', profileRoutes);
const passwordRoutes = require('./routes/passwordRoutes')(helpers);
app.use('/api/password', passwordRoutes);
const complaintsRoutes = require('./routes/complaintsRoutes')(helpers);
app.use('/api/complaints', complaintsRoutes);
const eventsRoutes = require('./routes/eventsRoutes')(helpers);
app.use('/api/events', eventsRoutes);
const meetingsRoutes = require('./routes/meetingsRoutes')(helpers);
app.use('/api/meetings', meetingsRoutes);
const leavesRoutes = require('./routes/leavesRoutes')(helpers);
app.use('/api/leaves', leavesRoutes);
const syllabusRoutes = require('./routes/syllabusRoutes')(helpers);
app.use('/api/syllabus', syllabusRoutes);
const noticesRoutes = require('./routes/noticesRoutes')(helpers);
app.use('/api/notices', noticesRoutes);
const resourcesRoutes = require('./routes/resourcesRoutes')(helpers);
app.use('/api/resources', resourcesRoutes);
const formsRoutes = require('./routes/formsRoutes')(helpers);
app.use('/api/forms', formsRoutes);
const form_queryRoutes = require('./routes/form-queryRoutes')(helpers);
app.use('/api/form-query', form_queryRoutes);
const custom_form_queryRoutes = require('./routes/custom-form-queryRoutes')(helpers);
app.use('/api/custom-form-query', custom_form_queryRoutes);
const galleryRoutes = require('./routes/galleryRoutes')(helpers);
app.use('/api/gallery', galleryRoutes);
const timetableRoutes = require('./routes/timetableRoutes')(helpers);
app.use('/api/timetable', timetableRoutes);
const certificatesRoutes = require('./routes/certificatesRoutes')(helpers);
app.use('/api/certificates', certificatesRoutes);
const messagesRoutes = require('./routes/messagesRoutes')(helpers);
app.use('/api/messages', messagesRoutes);
const notificationsRoutes = require('./routes/notificationsRoutes')(helpers);
app.use('/api/notifications', notificationsRoutes);
const classesRoutes = require('./routes/classesRoutes')(helpers);
app.use('/api/classes', classesRoutes);
const front_officeRoutes = require('./routes/front-officeRoutes')(helpers);
app.use('/api/front-office', front_officeRoutes);
const admission_enquiryRoutes = require('./routes/admission-enquiryRoutes')(helpers);
app.use('/api/admission-enquiry', admission_enquiryRoutes);
const online_admissionRoutes = require('./routes/online-admissionRoutes')(helpers);
app.use('/api/online-admission', online_admissionRoutes);
const discountsRoutes = require('./routes/discountsRoutes')(helpers);
app.use('/api/discounts', discountsRoutes);
const exportRoutes = require('./routes/exportRoutes')(helpers);
app.use('/api/export', exportRoutes);
const notification_settingsRoutes = require('./routes/notification-settingsRoutes')(helpers);
app.use('/api/notification-settings', notification_settingsRoutes);


let server;
if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);
  const numCPUs = os.cpus().length;
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died. Forking a new one...`);
    cluster.fork();
  });
} else {
  server = app.listen(PORT, () => {
    console.log(`ERP backend listening on http://localhost:${PORT} (Worker ${process.pid})`);
  });
}

// Ensure basic classes (1..12) exist for legacy frontend expectations
if (cluster.isPrimary) {
  (async () => {
    try {
       const existing = await prisma.class.count().catch(() => 0);
      if (!existing || existing === 0) {
        const toCreate = Array.from({
          length: 12
        }, (_, i) => ({
          name: String(i + 1),
          subjects: []
        }));
        await prisma.class.createMany({ data: toCreate });
        console.log('Seeded default classes 1..12');
      };
    } catch (e) {
      console.warn('Could not seed default classes:', e && e.message);
    }
  })();
}

// Legacy-compatible faculty attendance endpoints used by existing frontend

// ===================== Excel Export APIs =====================

// ===================== Twilio Notifications =====================
const twilio = require('twilio');
let twilioClient;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('Twilio client initialized');
  } catch (e) {
    console.error('Failed to init twilio:', e.message);
  }
}
async function sendSMS(to, message) {
  if (!twilioClient || !to) return;
  try {
    // Format phone number to start with + if not already (assume India +91 for simplicity if 10 digits)
    let formattedTo = to.replace(/\D/g, '');
    if (formattedTo.length === 10) formattedTo = '+91' + formattedTo;else if (!formattedTo.startsWith('+')) formattedTo = '+' + formattedTo;
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
    if (formattedTo.length === 10) formattedTo = '+91' + formattedTo;else if (!formattedTo.startsWith('+')) formattedTo = '+' + formattedTo;
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
async function notifyEvent({
  event,
  emailOpts,
  phone,
  message
}) {
  try {
    const config = await NotificationSettings.findOne({
      event
    });
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
      await sendMail(emailOpts).catch(() => {});
    }
  } catch (e) {
    console.error('notifyEvent error:', e.message);
  }
}
// Global error handling middleware (must be registered after all routes)
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  const isProd = process.env.NODE_ENV === 'production';
  return res.status(err.status || 500).json({
    message: isProd ? 'Internal Server Error' : err.message,
    error: isProd ? {} : err
  });
});

// Graceful Shutdown implementation
const gracefulShutdown = signal => {
  console.log(`${signal} signal received: closing HTTP server`);
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
      if (false) {
        Promise.resolve().then(() => {
          console.log('Mongoose connection closed');
          process.exit(0);
        }).catch(err => {
          console.error('Error closing Mongoose connection:', err);
          process.exit(1);
        });
      } else {
        process.exit(0);
      }
    });
  } else {
    // Primary process: kill all workers before exiting to prevent orphans
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
    process.exit(0);
  }
  // Force exit after 10 seconds if shutdown hangs
  setTimeout(() => {
    console.error('Forcing shutdown due to timeout');
    process.exit(1);
  }, 10000);
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Handle nodemon restarts

// Catch unhandled rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', err => {
  console.error('Uncaught Exception thrown:', err);
  process.exit(1);
});