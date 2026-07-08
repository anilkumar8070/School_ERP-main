const mongoose = require('mongoose')

const TimetableSchema = new mongoose.Schema({
  class: { type: String, required: true },
  section: { type: String, default: 'ALL' },
  name: String,
  mime: String,
  filePath: String,
  // optional JSON content for timetables created in-app (not uploaded files)
  content: String,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now }
}, { timestamps: true })

module.exports = mongoose.models.Timetable || mongoose.model('Timetable', TimetableSchema)
