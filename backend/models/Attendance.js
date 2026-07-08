const mongoose = require('mongoose')

const AttendanceSchema = new mongoose.Schema({
  class: { type: String, required: true },
  section: { type: String },
  date: { type: String, required: true }, // YYYY-MM-DD
  records: [
    {
      studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
      status: { type: String, enum: ['present', 'absent'], default: 'present' },
      markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' }
    }
  ],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

module.exports = mongoose.model('Attendance', AttendanceSchema)
