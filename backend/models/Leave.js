const mongoose = require('mongoose')

const LeaveSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username: String,
  email: String,
  role: { type: String, enum: ['student','faculty','admin','parent','staff'], default: 'student' },
  class: String,
  section: String,
  rollNo: String,
  from: Date,
  to: Date,
  reason: String,
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  reviewedBy: String,
  reviewedAt: Date,
  reviewNote: String
}, { timestamps: true })

module.exports = mongoose.models.Leave || mongoose.model('Leave', LeaveSchema)
