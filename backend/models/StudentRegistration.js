const mongoose = require('mongoose')

const StudentRegistrationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  class: { type: String },
  medium: { type: String, enum: ['Hindi','English','Bengali','Tamil','Telugu','Marathi','Gujarati','Urdu','Kannada','Malayalam',''], default: 'English' },
  address: { type: String },
  school: { type: String },
  accessId: { type: String },
  avatar: { type: String },
  status: { type: String, default: 'pending' },
  note: { type: String },
}, { timestamps: true })

StudentRegistrationSchema.index({ email: 1 }, { unique: true })

module.exports = mongoose.models.StudentRegistration || mongoose.model('StudentRegistration', StudentRegistrationSchema)
