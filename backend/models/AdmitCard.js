const mongoose = require('mongoose')

const AdmitCardSchema = new mongoose.Schema({
  schoolName: { type: String, default: '' },
  examName: { type: String, default: '' },
  className: { type: String, default: '' },
  section: { type: String, default: '' },
  recipientId: { type: mongoose.Schema.Types.ObjectId, refPath: 'recipientType', required: false },
  recipientType: { type: String, enum: ['Student', 'Faculty', 'User', 'Other'], default: 'Student' },
  recipientName: { type: String, default: '' },
  rollNumber: { type: String, default: '' },
  examRollNumber: { type: String, default: '' },
  studentEmail: { type: String, default: '' },
  subjects: { type: Array, default: [] },
  instructions: { type: String, default: '' },
  dateOfExam: { type: String, default: '' },
  filePath: { type: String, default: '' },
  mime: { type: String, default: '' },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  issuedAt: { type: Date, default: Date.now }
}, { timestamps: true })

module.exports = mongoose.models.AdmitCard || mongoose.model('AdmitCard', AdmitCardSchema)
