const mongoose = require('mongoose')

const FacultyAttendanceSchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD
  records: [
    {
      facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' },
      status: { type: String, enum: ['present', 'absent'], default: 'present' },
      markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }
  ],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

module.exports = mongoose.models.FacultyAttendance || mongoose.model('FacultyAttendance', FacultyAttendanceSchema)
