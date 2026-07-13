const mongoose = require('mongoose')

const MeetingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  summary: String,
  datetime: { type: Date, required: true },
  link: String,
  // audience: 'all' | 'students' | 'faculty' | 'student'
  audience: { type: String, default: 'students' },
  // optional targeting for students
  class: String,
  section: String,
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

module.exports = mongoose.models.Meeting || mongoose.model('Meeting', MeetingSchema)
