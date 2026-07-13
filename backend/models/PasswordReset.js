const mongoose = require('mongoose')

const PasswordResetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true }
}, { timestamps: true })

module.exports = mongoose.models.PasswordReset || mongoose.model('PasswordReset', PasswordResetSchema)
