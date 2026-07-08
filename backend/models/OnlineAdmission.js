const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  studentName: { type: String, required: true },
  dob: { type: Date, required: true },
  gender: { type: String, required: true },
  address: { type: String, required: true },
  parentName: { type: String, required: true },
  parentPhone: { type: String, required: true },
  classApplying: { type: String, required: true },
  documentPath: { type: String }, // path to uploaded file
  status: { type: String, enum: ['Pending', 'Reviewed', 'Approved', 'Rejected'], default: 'Pending' },
  submittedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('OnlineAdmission', schema);
