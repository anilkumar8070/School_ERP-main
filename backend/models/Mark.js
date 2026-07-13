const mongoose = require('mongoose')

const MarkSchema = new mongoose.Schema({
  class: { type: String, required: true },
  section: { type: String },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  subject: { type: String },
  total: { type: Number },
  obtained: { type: Number },
  term: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

module.exports = mongoose.model('Mark', MarkSchema)
