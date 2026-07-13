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
