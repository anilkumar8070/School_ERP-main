const mongoose = require('mongoose')

const FacultySchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true },
  classGrade: { type: String },
  employeeId: { type: String },
  subject: { type: String },
  experience: { type: String },
  contact: { type: String },
  avatar: { type: String }
  ,
  // New: assignments array: multiple classes/sections and subjects per faculty
  assignments: [{
    class: { type: String },
    section: { type: String },
    subjects: [{ type: String }],
    isClassTeacher: { type: Boolean, default: false }
  }],
  // Role of faculty (used for promotion/ID card label)
  role: { type: String, enum: ['Asst. Teacher', 'Associate Teacher', 'Professor', 'Teacher', 'Other'], default: 'Asst. Teacher' },
  // House assignments: teacher can be mentor/head mentor/member of houses
  houses: [{
    house: { type: String },
    role: { type: String, enum: ['member', 'mentor', 'head mentor'], default: 'member' }
  }]
}, { timestamps: true })

// Ensure unique email across faculty
FacultySchema.index({ email: 1 }, { unique: true, sparse: true })

module.exports = mongoose.models.Faculty || mongoose.model('Faculty', FacultySchema)
