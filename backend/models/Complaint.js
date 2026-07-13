const mongoose = require('mongoose')

const ComplaintSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username: String,
  text: { type: String, required: true },
  priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
  status: { type: String, enum: ['Open', 'In Progress', 'Resolved', 'Closed'], default: 'Open' },
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

module.exports = mongoose.models.Complaint || mongoose.model('Complaint', ComplaintSchema)
