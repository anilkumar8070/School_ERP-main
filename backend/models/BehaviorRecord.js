const mongoose = require('mongoose')

const BehaviorRecordSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  studentName: { type: String, default: '' },
  class: { type: String, default: '' },
  section: { type: String, default: '' },
  rollNo: { type: String, default: '' },
  type: { type: String, enum: ['incident', 'remark', 'counseling'], required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  actionTaken: { type: String, default: '' },
  followUpDate: { type: String, default: '' },
  severity: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  status: { type: String, enum: ['open', 'monitoring', 'resolved'], default: 'open' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  recordedByName: { type: String, default: '' },
  recordDate: { type: String, required: true }
}, { timestamps: true })

BehaviorRecordSchema.index({ studentId: 1, recordDate: -1 })
BehaviorRecordSchema.index({ type: 1, status: 1 })

module.exports = mongoose.models.BehaviorRecord || mongoose.model('BehaviorRecord', BehaviorRecordSchema)
