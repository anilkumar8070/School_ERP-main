const mongoose = require('mongoose')

const DeletionRequestSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  studentEmail: String,
  studentName: String,
  class: String,
  section: String,
  rollNo: String,
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  requestedByName: String,
  note: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
}, { timestamps: true })

module.exports = mongoose.models.DeletionRequest || mongoose.model('DeletionRequest', DeletionRequestSchema)
