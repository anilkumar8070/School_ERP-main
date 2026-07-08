const mongoose = require('mongoose')

const TestResultSchema = new mongoose.Schema({
  test: { type: mongoose.Schema.Types.ObjectId, ref: 'TestSeries', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  name: String,
  email: String,
  rollNo: String,
  class: String,
  section: String,
  score: Number,
  total: Number,
  percentage: Number,
  submittedAt: Date,
  raw: mongoose.Schema.Types.Mixed
}, { timestamps: true })

// Prevent duplicate submissions by the same student/email for the same test.
// Use sparse indexes so documents without studentId or email won't conflict.
TestResultSchema.index({ test: 1, studentId: 1 }, { unique: true, sparse: true })
TestResultSchema.index({ test: 1, email: 1 }, { unique: true, sparse: true })

module.exports = mongoose.models.TestResult || mongoose.model('TestResult', TestResultSchema)
