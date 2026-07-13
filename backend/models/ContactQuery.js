const mongoose = require('mongoose')

const ContactQuerySchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  contact: { type: String },
  description: { type: String },
  filename: { type: String },
  originalname: { type: String },
  status: { type: String, default: 'in progress' }, // in progress|closed|solved
  notified: { type: Boolean, default: false },
  // Notes left by admins when updating the query. Keep history.
  notes: [{ text: { type: String }, author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, createdAt: { type: Date, default: Date.now } }],
  // Backwards-compatible single note field (optional)
  note: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

module.exports = mongoose.model('ContactQuery', ContactQuerySchema)
