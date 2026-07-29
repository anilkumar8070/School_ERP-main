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

// (timetable endpoints implemented later — keep single richer implementation)

// Admin helper: regenerate PDFs for timetables that have `content` but no `filePath`.
// Useful after installing pdfkit if earlier saves didn't create PDFs.
router.post("/regenerate-pdfs", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const items = await Timetable.find({
      content: {
        $exists: true,
        $ne: null
      },
      $or: [{
        filePath: {
          $exists: false
        }
      }, {
        filePath: null
      }, {
        filePath: ''
      }]
    });
    if (!items || items.length === 0) return res.json({
      regenerated: 0,
      message: 'No timetables need regeneration'
    });

    // pdfkit require consolidated at top of file
    const results = [];
    for (const t of items) {
      try {
        const content = typeof t.content === 'string' ? JSON.parse(t.content) : t.content;
        const filename = `${Date.now()}_${String(t.class || 'cls')}_${String(t.section || 'ALL')}_timetable.pdf`.replace(/\s+/g, '_');
        const outPath = path.join(uploadsDir, filename);
        const pdfDoc = new PDFDocument({
          margin: 30,
          size: 'A4'
        });
        const stream = fs.createWriteStream(outPath);
        pdfDoc.pipe(stream);
        pdfDoc.fontSize(18).text(String(t.name || 'Timetable'), {
          align: 'center'
        });
        pdfDoc.moveDown();
        if (content && typeof content === 'object') {
          const days = Object.keys(content);
          const periodOrder = [];
          const seen = new Set();
          for (const d of days) {
            const row = content[d] || {};
            for (const p of Object.keys(row)) {
              if (!seen.has(p)) {
                seen.add(p);
                periodOrder.push(p);
              }
            }
          }

          // Table layout
          const left = pdfDoc.page.margins.left;
          const pageWidth = pdfDoc.page.width - pdfDoc.page.margins.left - pdfDoc.page.margins.right;
          const dayCol = Math.max(80, Math.floor(pageWidth * 0.18));
          const remaining = Math.max(0, pageWidth - dayCol);
          const colWidth = periodOrder.length ? Math.floor(remaining / periodOrder.length) : remaining;
          const headerH = 26;
          const rowH = 22;
          let xStart = left;
          let y = pdfDoc.y;

          // draw header cells
          pdfDoc.font('Helvetica-Bold').fontSize(12);
          pdfDoc.fillColor('#111827');
          // Day header
          pdfDoc.rect(xStart, y, dayCol, headerH).fill('#f3f4f6');
          pdfDoc.fillColor('#0f172a').text('Day', xStart + 6, y + 6, {
            width: dayCol - 12,
            align: 'left'
          });
          xStart += dayCol;
          // Period headers
          for (const p of periodOrder) {
            pdfDoc.fillColor('#111827');
            pdfDoc.rect(xStart, y, colWidth, headerH).fill('#f3f4f6');
            pdfDoc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text(p, xStart + 4, y + 6, {
              width: colWidth - 8,
              align: 'center'
            });
            xStart += colWidth;
          }

          // draw rows
          pdfDoc.font('Helvetica').fontSize(10);
          y += headerH;
          for (const d of days) {
            xStart = left;
            // Day cell
            pdfDoc.fillColor('#ffffff').rect(xStart, y, dayCol, rowH).fill();
            pdfDoc.fillColor('#0b1220').text(String(d), xStart + 6, y + 6, {
              width: dayCol - 12,
              align: 'left'
            });
            xStart += dayCol;
            // Period cells
            for (const p of periodOrder) {
              pdfDoc.fillColor('#ffffff').rect(xStart, y, colWidth, rowH).fill();
              const txt = String(content[d] && content[d][p] || '');
              pdfDoc.fillColor('#0b1220').text(txt, xStart + 4, y + 6, {
                width: colWidth - 8,
                align: 'center'
              });
              xStart += colWidth;
            }

            // draw borders for this row (simple lines)
            pdfDoc.strokeColor('#e5e7eb').lineWidth(0.5);
            let vx = left;
            pdfDoc.moveTo(vx, y).lineTo(vx + dayCol + colWidth * periodOrder.length, y).stroke();
            for (let i = 0; i <= periodOrder.length; i++) {
              pdfDoc.moveTo(vx, y).lineTo(vx, y + rowH).stroke();
              vx += i === 0 ? dayCol : colWidth;
            }
            pdfDoc.moveTo(left, y + rowH).lineTo(left + dayCol + colWidth * periodOrder.length, y + rowH).stroke();
            y += rowH;
            // check page break
            if (y + rowH + 60 > pdfDoc.page.height - pdfDoc.page.margins.bottom) {
              pdfDoc.addPage();
              y = pdfDoc.page.margins.top;
            }
          }
          // move cursor after table
          pdfDoc.moveDown();
        } else {
          pdfDoc.fontSize(12).text(String(t.content));
        }
        pdfDoc.end();
        await new Promise((resolve, reject) => {
          stream.on('finish', resolve);
          stream.on('error', reject);
        });
        const fileP = `/uploads/${filename}`;
        await Timetable.findByIdAndUpdate(t._id, {
          filePath: fileP,
          mime: 'application/pdf'
        });
        results.push({
          id: t._id,
          filePath: fileP
        });
      } catch (errT) {
        console.warn('Failed to regenerate PDF for timetable', t._id, errT && (errT.message || String(errT)));
      }
    }
    return res.json({
      regenerated: results.length,
      items: results
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Regenerate PDF for a single timetable id
router.post("/:id/regenerate-pdf", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const id = req.params.id;
    const t = await prisma.timetable.findUnique({ where: { id: String(id) } });
    if (!t) return res.status(404).json({
      message: 'Timetable not found'
    });
    if (!t.content) return res.status(400).json({
      message: 'No content to generate PDF from'
    });

    // pdfkit require consolidated at top of file
    const content = typeof t.content === 'string' ? (() => {
      try {
        return JSON.parse(t.content);
      } catch (e) {
        return null;
      }
    })() : t.content;
    const filename = `${Date.now()}_${String(t.class || 'cls')}_${String(t.section || 'ALL')}_timetable.pdf`.replace(/\s+/g, '_');
    const outPath = path.join(uploadsDir, filename);
    const pdfDoc = new PDFDocument({
      margin: 30,
      size: 'A4'
    });
    const stream = fs.createWriteStream(outPath);
    pdfDoc.pipe(stream);
    pdfDoc.fontSize(18).text(String(t.name || 'Timetable'), {
      align: 'center'
    });
    pdfDoc.moveDown();
    if (content && typeof content === 'object') {
      const days = Object.keys(content);
      const periodOrder = [];
      const seen = new Set();
      for (const d of days) {
        const row = content[d] || {};
        for (const p of Object.keys(row)) {
          if (!seen.has(p)) {
            seen.add(p);
            periodOrder.push(p);
          }
        }
      }
      const left = pdfDoc.page.margins.left;
      const pageWidth = pdfDoc.page.width - pdfDoc.page.margins.left - pdfDoc.page.margins.right;
      const dayCol = Math.max(80, Math.floor(pageWidth * 0.18));
      const remaining = Math.max(0, pageWidth - dayCol);
      const colWidth = periodOrder.length ? Math.floor(remaining / periodOrder.length) : remaining;
      const headerH = 26;
      const rowH = 22;
      let xStart = left;
      let y = pdfDoc.y;
      pdfDoc.font('Helvetica-Bold').fontSize(12);
      pdfDoc.fillColor('#111827');
      pdfDoc.rect(xStart, y, dayCol, headerH).fill('#f3f4f6');
      pdfDoc.fillColor('#0f172a').text('Day', xStart + 6, y + 6, {
        width: dayCol - 12,
        align: 'left'
      });
      xStart += dayCol;
      for (const p of periodOrder) {
        pdfDoc.fillColor('#111827');
        pdfDoc.rect(xStart, y, colWidth, headerH).fill('#f3f4f6');
        pdfDoc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text(p, xStart + 4, y + 6, {
          width: colWidth - 8,
          align: 'center'
        });
        xStart += colWidth;
      }
      pdfDoc.font('Helvetica').fontSize(10);
      y += headerH;
      for (const d of days) {
        xStart = left;
        pdfDoc.fillColor('#ffffff').rect(xStart, y, dayCol, rowH).fill();
        pdfDoc.fillColor('#0b1220').text(String(d), xStart + 6, y + 6, {
          width: dayCol - 12,
          align: 'left'
        });
        xStart += dayCol;
        for (const p of periodOrder) {
          pdfDoc.fillColor('#ffffff').rect(xStart, y, colWidth, rowH).fill();
          const txt = String(content[d] && content[d][p] || '');
          pdfDoc.fillColor('#0b1220').text(txt, xStart + 4, y + 6, {
            width: colWidth - 8,
            align: 'center'
          });
          xStart += colWidth;
        }
        pdfDoc.strokeColor('#e5e7eb').lineWidth(0.5);
        let vx = left;
        pdfDoc.moveTo(vx, y).lineTo(vx + dayCol + colWidth * periodOrder.length, y).stroke();
        for (let i = 0; i <= periodOrder.length; i++) {
          pdfDoc.moveTo(vx, y).lineTo(vx, y + rowH).stroke();
          vx += i === 0 ? dayCol : colWidth;
        }
        pdfDoc.moveTo(left, y + rowH).lineTo(left + dayCol + colWidth * periodOrder.length, y + rowH).stroke();
        y += rowH;
        if (y + rowH + 60 > pdfDoc.page.height - pdfDoc.page.margins.bottom) {
          pdfDoc.addPage();
          y = pdfDoc.page.margins.top;
        }
      }
      pdfDoc.moveDown();
    } else {
      pdfDoc.fontSize(12).text(String(t.content));
    }
    pdfDoc.end();
    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
    const fileP = `/uploads/${filename}`;
    const updated = await Timetable.findByIdAndUpdate(id, {
      filePath: fileP,
      mime: 'application/pdf'
    }, {
      new: true
    });
    return res.json(updated);
  } catch (e) {
    console.error('Failed to regenerate single timetable PDF:', e && e.message);
    return res.status(500).json({
      message: e.message
    });
  }
});

// Faculty: list submissions for an assignment

// Timetable endpoints - allow admin to upload a timetable (file or JSON content)
router.post("/", verifyToken, requireRole('admin'), upload.single('file'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const cls = req.body.class || req.body.k || req.body.klass;
    const section = req.body.section || req.body.sec || 'ALL';
    const name = req.body.name || req.file && req.file.originalname || `Timetable ${cls || ''} ${section || ''}`;
    const content = req.body.content || null;
    if (!cls) return res.status(400).json({
      message: 'class required'
    });
    const doc = {
      class: String(cls),
      section: section || 'ALL',
      name,
      uploadedBy: req.user && req.user.sub
    };
    if (req.file) {
      doc.mime = req.file.mimetype;
      doc.filePath = `/uploads/${req.file.filename}`;
    }
    if (content) doc.content = content;
    let created = await prisma.timetable.create({ data: doc });

    // If JSON content was provided and no file uploaded, generate a PDF snapshot and save it to uploads
    try {
      if (content && !req.file) {
        try {
          // pdfkit require consolidated at top of file
          const filename = Date.now() + `_timetable.pdf`;
          const outPath = path.join(uploadsDir, filename);
          const pdfDoc = new PDFDocument({
            margin: 30,
            size: 'A4'
          });
          const stream = fs.createWriteStream(outPath);
          pdfDoc.pipe(stream);

          // attempt to parse JSON content (it may be a string)
          let parsed = null;
          try {
            parsed = typeof content === 'string' ? JSON.parse(content) : content;
          } catch (e) {
            parsed = null;
          }

          // Render a simple printable timetable
          pdfDoc.fontSize(18).text(String(name || 'Timetable'), {
            align: 'center'
          });
          pdfDoc.moveDown();
          if (parsed && typeof parsed === 'object') {
            const days = Object.keys(parsed);
            const periodOrder = [];
            const seen = new Set();
            for (const d of days) {
              const row = parsed[d] || {};
              for (const p of Object.keys(row)) {
                if (!seen.has(p)) {
                  seen.add(p);
                  periodOrder.push(p);
                }
              }
            }

            // Table layout
            const left = pdfDoc.page.margins.left;
            const pageWidth = pdfDoc.page.width - pdfDoc.page.margins.left - pdfDoc.page.margins.right;
            const dayCol = Math.max(80, Math.floor(pageWidth * 0.18));
            const remaining = Math.max(0, pageWidth - dayCol);
            const colWidth = periodOrder.length ? Math.floor(remaining / periodOrder.length) : remaining;
            const headerH = 26;
            const rowH = 22;
            let xStart = left;
            let y = pdfDoc.y;

            // header
            pdfDoc.font('Helvetica-Bold').fontSize(12);
            pdfDoc.fillColor('#111827');
            pdfDoc.rect(xStart, y, dayCol, headerH).fill('#f3f4f6');
            pdfDoc.fillColor('#0f172a').text('Day', xStart + 6, y + 6, {
              width: dayCol - 12,
              align: 'left'
            });
            xStart += dayCol;
            for (const p of periodOrder) {
              pdfDoc.fillColor('#111827');
              pdfDoc.rect(xStart, y, colWidth, headerH).fill('#f3f4f6');
              pdfDoc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text(p, xStart + 4, y + 6, {
                width: colWidth - 8,
                align: 'center'
              });
              xStart += colWidth;
            }

            // rows
            pdfDoc.font('Helvetica').fontSize(10);
            y += headerH;
            for (const d of days) {
              xStart = left;
              pdfDoc.fillColor('#ffffff').rect(xStart, y, dayCol, rowH).fill();
              pdfDoc.fillColor('#0b1220').text(String(d), xStart + 6, y + 6, {
                width: dayCol - 12,
                align: 'left'
              });
              xStart += dayCol;
              for (const p of periodOrder) {
                pdfDoc.fillColor('#ffffff').rect(xStart, y, colWidth, rowH).fill();
                const txt = String(parsed[d] && parsed[d][p] || '');
                pdfDoc.fillColor('#0b1220').text(txt, xStart + 4, y + 6, {
                  width: colWidth - 8,
                  align: 'center'
                });
                xStart += colWidth;
              }

              // borders
              pdfDoc.strokeColor('#e5e7eb').lineWidth(0.5);
              let vx = left;
              pdfDoc.moveTo(vx, y).lineTo(vx + dayCol + colWidth * periodOrder.length, y).stroke();
              for (let i = 0; i <= periodOrder.length; i++) {
                pdfDoc.moveTo(vx, y).lineTo(vx, y + rowH).stroke();
                vx += i === 0 ? dayCol : colWidth;
              }
              pdfDoc.moveTo(left, y + rowH).lineTo(left + dayCol + colWidth * periodOrder.length, y + rowH).stroke();
              y += rowH;
              if (y + rowH + 60 > pdfDoc.page.height - pdfDoc.page.margins.bottom) {
                pdfDoc.addPage();
                y = pdfDoc.page.margins.top;
              }
            }
            pdfDoc.moveDown();
          } else {
            pdfDoc.fontSize(12).text(String(content));
          }
          pdfDoc.end();
          // await stream finish
          await new Promise((resolve, reject) => {
            stream.on('finish', resolve);
            stream.on('error', reject);
          });

          // update timetable doc with filePath and mime
          const fileP = `/uploads/${filename}`;
          created = await Timetable.findByIdAndUpdate(created._id, {
            filePath: fileP,
            mime: 'application/pdf'
          }, {
            new: true
          });
        } catch (pdfErr) {
          console.warn('Failed to generate timetable PDF:', pdfErr && (pdfErr.message || String(pdfErr)));
        }
      }
    } catch (inner) {
      console.warn('Unexpected error while generating timetable PDF:', inner && (inner.message || String(inner)));
    }
    try {
      sendSseEvent('timetable_uploaded', {
        id: created._id,
        class: created.class,
        section: created.section,
        name: created.name
      });
    } catch (e) {}
    return res.status(201).json(created);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Query timetables for a class/section. Returns history (newest-first).
router.get("/", async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const cls = req.query.class || req.query.k || null;
    const section = req.query.section || req.query.sec || null;
    if (!cls) return res.json([]);
    const q = {
      class: String(cls)
    };
    if (section) {
      q.$or = [{
        section
      }, {
        section: 'ALL'
      }];
    }
    const items = await prisma.timetable.findMany({ where: q }).sort({
      uploadedAt: -1
    });
    return res.json(items);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// Leaves

// Certificates: admin can generate/send certificates; users can list their certificates

  return router;
};
