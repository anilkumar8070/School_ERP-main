const mongoose = require('mongoose')
const Schema = mongoose.Schema

const ReportCardSchema = new Schema({
  schoolName: { type: String, default: '' },
  examName: { type: String, default: '' },
  className: { type: String, default: '' },
  section: { type: String, default: '' },
  recipientId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  recipientName: { type: String, default: '' },
  recipientEmail: { type: String, default: '' },
  rollNumber: { type: String, default: '' },
  arRollNo: { type: String, default: '' },
  templateType: { type: String, enum: ['cbse', 'normal'], default: 'normal' },
  subjects: { type: Array, default: [] },
  total: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  filePath: { type: String, default: '' },
  mime: { type: String, default: 'application/pdf' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('ReportCard', ReportCardSchema)
