const mongoose = require('mongoose')

const MessageSchema = new mongoose.Schema({
  parentName: String,
  studentName: String,
  className: String,
  subject: String,
  description: { type: String, required: true },
  priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
  // Include 'Replied' so admin or system replies can set this status without validation errors
  status: { type: String, enum: ['New', 'In Progress', 'Replied', 'Resolved', 'Closed', 'Reopened'], default: 'New' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByUsername: String,
  history: [
    {
      by: String,
      role: String,
      note: String,
      status: String,
      at: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true })

module.exports = mongoose.models.Message || mongoose.model('Message', MessageSchema)
