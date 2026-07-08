const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  studentName: { type: String }, // cached for easy querying
  type: { type: String, enum: ['Sibling', 'Merit', 'Staff Ward', 'Custom'], required: true },
  amount: { type: Number, required: true },
  amountType: { type: String, enum: ['percentage', 'flat'], default: 'flat' },
  term: { type: String, enum: ['Term1', 'Term2', 'Both'], required: true },
  reason: { type: String },
  appliedBy: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Discount', schema);
