const mongoose = require('mongoose')

const IDCardSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', index: true },
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  type: { type: String, enum: ['student', 'faculty', 'staff'], default: 'student', index: true },
  name: { type: String },
  fatherName: { type: String },
  rollNo: { type: String },
  class: { type: String },
  gender: { type: String },
  medium: { type: String },
  section: { type: String },
  contact: { type: String },
  email: { type: String },
  designation: { type: String },
  schoolName: { type: String, default: 'SCHOOL NAME' },
  photoUrl: { type: String },
  house: { type: String },
  houseRole: { type: String },
  template: { type: String, default: 'default' },
  batchId: { type: String, index: true },
  version: { type: Number, default: 1 },
  generatedBy: { type: String },
  idCode: { type: String, unique: true, index: true },
  issueDate: { type: Date },
  validUpto: { type: Date },
}, { timestamps: true })

module.exports = mongoose.models.IDCard || mongoose.model('IDCard', IDCardSchema)
