const mongoose = require('mongoose')

const TestSeriesSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: { type: String },
  term: { type: String, default: 'Term 1' },
  type: { type: String, enum: ['google_form', 'bulk', 'internal', 'series'], default: 'google_form' },
  link: String,
  filePath: String,
  classes: [String],
  sections: [String],
  start: Date,
  durationMinutes: Number,
  attempts: { type: Number, default: 1 },
  description: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

module.exports = mongoose.models.TestSeries || mongoose.model('TestSeries', TestSeriesSchema)
