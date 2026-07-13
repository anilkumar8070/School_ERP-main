const mongoose = require('mongoose')

const FacultyRegistrationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  subject: { type: String },
  classGrade: { type: String },
  education: { type: String },
  experience: { type: String },
  contact: { type: String },
  avatar: { type: String },
  houses: [{
    house: { type: String },
    role: { type: String, enum: ['member', 'mentor', 'head mentor'], default: 'member' }
  }],
  status: { type: String, default: 'pending' }, // pending, approved, rejected
  note: { type: String },
  password: { type: String },
}, { timestamps: true })

FacultyRegistrationSchema.index({ email: 1 }, { unique: true })

module.exports = mongoose.models.FacultyRegistration || mongoose.model('FacultyRegistration', FacultyRegistrationSchema)
