const mongoose = require('mongoose')

const NotificationSettingsSchema = new mongoose.Schema({
  event: { type: String, required: true, unique: true },
  email: { type: Boolean, default: true },
  sms: { type: Boolean, default: false },
  whatsapp: { type: Boolean, default: false }
}, { timestamps: true })

module.exports = mongoose.models.NotificationSettings || mongoose.model('NotificationSettings', NotificationSettingsSchema)
