const prisma = require('../prisma/client');
const fs = require('fs')
const path = require('path')
const multer = require('multer')

module.exports = function registerAdmitCardRoutes(app, deps = {}) {
  const { uploadsDir, Student, User, AdmitCard, PDFDocument } = deps
  // In case deps not provided, try to require from parent env
  const _uploadsDir = uploadsDir || path.join(__dirname, '..', 'uploads')
  const _Student = prisma.student;
  const _User = prisma.user;
  const _AdmitCard = prisma.admitCard;
  const _PDFDocument = PDFDocument || (() => {
    try { return require('pdfkit') } catch (e) { return null }
  })()

  const upload = multer()

  const { verifyToken } = require('../middleware/auth')

  app.post('/api/admitcards', async (req, res) => {
    // Only admin/faculty should call this route; middleware in index.js should protect it
    try {
      upload.single('signature')(req, res, async function (err) {
        if (err) return res.status(500).json({ message: 'Upload failed' })
        const { schoolName, examName, className, section, dateOfExam, note, instructions } = req.body || {}
        let subjects = []
        try { subjects = req.body.subjects ? JSON.parse(req.body.subjects) : [] } catch (e) { subjects = [] }
        if (!className || !examName) return res.status(400).json({ message: 'className and examName are required' })
        // support selecting ALL sections by passing section='ALL' or leaving section empty
        const studentQuery = { class: className }
        if (section && String(section).toUpperCase() !== 'ALL') studentQuery.section = section
        const students = await _Student.findMany({ where: studentQuery }).catch(() => [])
        if (!students || students.length === 0) {
          console.warn('No students found for query', studentQuery)
          return res.json({ ok: true, count: 0, results: [] })
        }
        const results = []
        for (const s of students) {
          try {
            let userId = null
            if (s && s.email) {
              const u = await _User.findFirst({ where: { username: s.email } }).catch(() => null)
              if (u && u.id) userId = u.id
            }

            // generate a unique exam roll number for this student
            const examRollNumber = `${String(className)}-${String(section)}-${String(s.rollNo||String(s.id)).slice(-6)}-${Date.now().toString().slice(-4)}`

            if (!_PDFDocument) {
              // no pdf support: create metadata only
              const admitDoc = await _AdmitCard.create({ data: {  schoolName: schoolName||'', examName: examName||'', className, section, recipientId: userId || s.id, recipientType: 'Student', recipientName: s.name||'', rollNumber: s.rollNo||'', examRollNumber, studentEmail: s.email||'', dateOfExam: dateOfExam||'', subjects, instructions: instructions||'', filePath: '', mime: ''  } })
              results.push(admitDoc)
              continue
            }

            const doc = new _PDFDocument({ size: 'A4', margin: 40 })
            const fname = `${Date.now()}_admit_${String(s.id).slice(-6)}.pdf`.replace(/\s+/g, '_')
            const outPath = path.join(_uploadsDir, fname)
            const stream = fs.createWriteStream(outPath)
            doc.pipe(stream)

            // --- Styled admit card layout (matches sample format) ---
            // Header band with school name and exam title
            const pageW = doc.page.width
            doc.save()
            doc.rect(0, 0, pageW, 90).fill('#0B5FFF')
            doc.fillColor('white').fontSize(20).text(String(schoolName || 'School Name'), 50, 24, { align: 'left' })
            doc.fontSize(12).text(String(examName || 'Examination'), 50, 48, { align: 'left' })

            // Right side small logo/placeholder box
            doc.rect(pageW - 140, 16, 110, 60).stroke('#ffffff')
            doc.fontSize(9).fillColor('white').text('Logo', pageW - 110, 40, { align: 'center' })
            doc.restore()

            // Main content box
            const marginX = 40
            let y = 110
            doc.roundedRect(marginX, y, pageW - marginX * 2, 650, 6).stroke('#0B5FFF')

            // Title inside box
            doc.fontSize(18).fillColor('#0B5FFF').text('Admit Card', marginX + 12, y + 12)

            // Left: student details; Right: photo and exam meta
            const leftX = marginX + 12
            const rightX = pageW - marginX - 160
            let cursorY = y + 50

            doc.fillColor('#222222').fontSize(11)
            doc.text(`Name: ${s.name || ''}`, leftX, cursorY)
            doc.text(`Class: ${className || ''}`, leftX, cursorY + 18)
            doc.text(`Section: ${section || ''}`, leftX, cursorY + 36)
            doc.text(`Roll No: ${s.rollNo || ''}`, leftX, cursorY + 54)
            doc.text(`Exam Roll No: ${examRollNumber}`, leftX, cursorY + 72)
            doc.text(`Email: ${s.email || ''}`, leftX, cursorY + 90)
            if (s.gender) doc.text(`Gender: ${s.gender}`, leftX, cursorY + 108)
            if (s.category) doc.text(`Category: ${s.category}`, leftX, cursorY + 126)

            // Student photo box
            doc.rect(rightX, cursorY - 6, 120, 140).stroke('#CCCCCC')
            try {
              if (s.avatar && String(s.avatar).startsWith('/')) {
                const avatarPath = path.join(__dirname, '..', s.avatar.replace(/^\//, ''))
                if (fs.existsSync(avatarPath)) doc.image(avatarPath, rightX + 4, cursorY - 2, { width: 112, height: 132, fit: [112, 132] })
              }
            } catch (e) { /* ignore avatar errors */ }
            doc.fontSize(9).fillColor('#666').text('Student Photo', rightX + 14, cursorY + 60)

            // Exam details under photo
            doc.fillColor('#222').fontSize(10).text(`Exam Date: ${dateOfExam || ''}`, rightX, cursorY + 150)
            if (note) doc.fontSize(9).fillColor('#444').text(`Note: ${note}`, leftX, cursorY + 150)

            // Subjects table heading
            let tableY = cursorY + 190
            doc.fontSize(12).fillColor('#000').text('S.No', leftX, tableY)
            doc.text('Subject Code', leftX + 60, tableY)
            doc.text('Name of Subjects Offered', leftX + 160, tableY)
            doc.text('Exam-Date / Time', pageW - marginX - 160, tableY)
            tableY += 18
            doc.moveTo(leftX, tableY - 6).lineTo(pageW - marginX - 12, tableY - 6).stroke('#cccccc')

            if (subjects && subjects.length) {
              subjects.forEach((sub, idx) => {
                const code = sub.code || sub.subjectCode || ''
                const name = sub.subject || sub.name || ''
                const date = sub.date || sub.examDate || ''
                const from = sub.from || sub.fromTime || ''
                const to = sub.to || sub.toTime || ''
                doc.fontSize(10).fillColor('#111').text(`${idx + 1}`, leftX, tableY)
                doc.text(code, leftX + 60, tableY)
                doc.text(name, leftX + 160, tableY, { width: pageW - marginX - 360 })
                doc.text(`${date} ${from ? '(' + from + (to ? ' - ' + to : '') + ')' : ''}`, pageW - marginX - 160, tableY)
                tableY += 18
              })
            } else {
              doc.fontSize(10).fillColor('#666').text('No subjects provided', leftX, tableY)
              tableY += 18
            }

            // Barcode / Roll visual area
            const barcodeY = tableY + 18
            doc.rect(leftX, barcodeY, 300, 40).stroke('#000')
            doc.fontSize(12).fillColor('#000').text(s.rollNo || examRollNumber || '', leftX + 8, barcodeY + 12)

            // Signature area on bottom-right
            const sigY = barcodeY + 70
            if (req.file && req.file.buffer && signaturePath) {
              try { doc.image(signaturePath, pageW - marginX - 180, sigY - 10, { width: 140 }) } catch (e) { /* ignore */ }
            }
            doc.fontSize(10).fillColor('#444').text('Authorised Signature', pageW - marginX - 180, sigY + 50)

            // Instructions at the bottom
            const instY = sigY + 90
            if (instructions || true) {
              doc.fontSize(9).fillColor('#222').text('Important Instructions :', leftX, instY)
              const instText = (instructions && String(instructions).trim()) || String(note || '') || '1. Reach half an hour before exam time. 2. Carry ID card and hall ticket.'
              doc.fontSize(8).fillColor('#333').text(instText, leftX, instY + 16, { width: pageW - marginX * 2 })
            }

            doc.end()
            await new Promise((resolve) => stream.on('finish', resolve))

            const admitDoc = await _AdmitCard.create({ data: {  schoolName: schoolName||'', examName: examName||'', className, section, recipientId: userId || s.id, recipientType: 'Student', recipientName: s.name||'', rollNumber: s.rollNo||'', examRollNumber, studentEmail: s.email||'', dateOfExam: dateOfExam||'', subjects, instructions: instructions||'', filePath: `/uploads/${fname}`, mime: 'application/pdf'  } })
            results.push(admitDoc)
          } catch (e) {
            console.warn('Failed to generate admit card for student', s && s.id, e && e.message)
          }
        }
        return res.json({ ok: true, count: results.length, results })
      })
    } catch (e) { return res.status(500).json({ message: e.message }) }
  })

  app.get('/api/admitcards', async (req, res) => {
    try {
      const list = await _AdmitCard.find({}).sort({ createdAt: -1 }).catch(() => [])
      return res.json(list)
    } catch (e) { return res.status(500).json({ message: e.message }) }
  })

  // Download admit card PDF (authenticated). Supports token via Authorization header or ?token= in query.
  app.get('/api/admitcards/:id/download', verifyToken, async (req, res) => {
    try {
      const id = req.params && req.params.id
      if (!id) return res.status(400).json({ message: 'id required' })
      const doc = await _AdmitCard.findById(id).catch(() => null)
      if (!doc || !doc.filePath) return res.status(404).json({ message: 'File not found' })
      // filePath is expected to be like /uploads/filename.pdf
      const fp = String(doc.filePath || '').replace(/^\//, '')
      const abs = path.join(__dirname, '..', fp)
      if (!fs.existsSync(abs)) return res.status(404).json({ message: 'File missing on server' })
      // Use res.download to set Content-Disposition header
      return res.download(abs, path.basename(abs), (err) => {
        if (err) console.warn('Failed to send admitcard file', err && err.message)
      })
    } catch (e) { return res.status(500).json({ message: e.message }) }
  })

  app.get('/api/admitcards/my', verifyToken, async (req, res) => {
    try {
      const userId = req.user && req.user.sub
      if (!userId) return res.status(401).json({ message: 'Not authenticated' })
      const u = await _User.findById(userId).catch(() => null)
      const name = u && u.name ? u.name : ''
      const q = { $or: [{ recipientId: userId }] }
      if (name) q.$or.push({ recipientName: { $regex: name, $options: 'i' } })
      const list = await _AdmitCard.find(q).sort({ createdAt: -1 }).catch(() => [])
      return res.json(list)
    } catch (e) { return res.status(500).json({ message: e.message }) }
  })
}
