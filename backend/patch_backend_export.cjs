const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'index.js');
let code = fs.readFileSync(file, 'utf8');

const exportRoutes = `
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
`

// Insert just before the global error handler which must be last
code = code.replace(/\/\/ Global error handling middleware/, exportRoutes + '\n// Global error handling middleware');
fs.writeFileSync(file, code);
console.log('Patched index.js with export routes');
