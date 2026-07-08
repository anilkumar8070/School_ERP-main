const mongoose = require('mongoose')

const SyllabusSchema = new mongoose.Schema({
  class: { type: String, required: true },
  section: { type: String, default: 'ALL' },
  subject: String,
  name: String,
  mime: String,
  filePath: String,
  content: String,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now }
}, { timestamps: true })

module.exports = mongoose.models.Syllabus || mongoose.model('Syllabus', SyllabusSchema)
