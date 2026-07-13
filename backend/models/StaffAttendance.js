const mongoose = require('mongoose')

const StaffAttendanceSchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD
  records: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      status: { type: String, enum: ['present', 'absent', 'leave'], default: 'present' },
      markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }
  ],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

module.exports = mongoose.models.StaffAttendance || mongoose.model('StaffAttendance', StaffAttendanceSchema)
