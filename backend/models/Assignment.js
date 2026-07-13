const mongoose = require('mongoose')

const AssignmentSchema = new mongoose.Schema({
  subject: String,
  filePath: String,
  title: { type: String, required: true },
  description: String,
  class: { type: String, required: true },
  section: { type: String, default: 'ALL' },
  dueDate: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

module.exports = mongoose.models.Assignment || mongoose.model('Assignment', AssignmentSchema)
