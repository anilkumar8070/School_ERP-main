const mongoose = require('mongoose')

const SubmissionSchema = new mongoose.Schema({
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  studentName: String,
  studentRoll: String,
  studentClass: String,
  studentEmail: String,
  answerText: String,
  filePath: String,
  submittedAt: { type: Date, default: Date.now }
}, { timestamps: true })

module.exports = mongoose.models.Submission || mongoose.model('Submission', SubmissionSchema)
