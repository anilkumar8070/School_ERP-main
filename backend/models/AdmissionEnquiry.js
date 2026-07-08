const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  applicantName: { type: String, required: true },
  parentName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  classApplying: { type: String, required: true },
  enquiryDate: { type: Date, required: true, default: Date.now },
  status: { type: String, enum: ['New', 'Follow-up', 'Enrolled', 'Dropped'], default: 'New' },
  notes: { type: String },
  createdBy: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('AdmissionEnquiry', schema);
