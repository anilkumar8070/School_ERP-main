const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  visitorName: { type: String, required: true },
  purpose: { type: String },
  host: { type: String },
  checkInTime: { type: Date, required: true, default: Date.now },
  checkOutTime: { type: Date },
  status: { type: String, enum: ['In', 'Out'], default: 'In' },
  notes: { type: String },
  createdBy: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('FrontOffice', schema);
