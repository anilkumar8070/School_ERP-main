const mongoose = require('mongoose')

const NoticeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, default: '' },
  targets: { type: [String], default: ['all'] }, // e.g. ['student','faculty','parent'] or ['all']
  // optional attached file (pdf)
  filePath: { type: String },
  fileName: { type: String },
  fileMime: { type: String },
  // optional student filter: if targets includes 'student', this defines who receives it
  studentAll: { type: Boolean, default: true },
  studentClass: { type: String },
  studentSection: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByName: String,
}, { timestamps: true })

module.exports = mongoose.models.Notice || mongoose.model('Notice', NoticeSchema)
