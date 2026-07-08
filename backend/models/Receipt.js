const mongoose = require('mongoose')

const ReceiptSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  allocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'HostelAllocation' },
  studentName: String,
  studentEmail: String,
  class: String,
  term: String,
  amount: Number,
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String
  ,
  // Optional server-generated receipt PDF URL/path
  pdfUrl: { type: String },
  pdfPath: { type: String },
  rollNo: { type: String }
}, { timestamps: true })

module.exports = mongoose.models.Receipt || mongoose.model('Receipt', ReceiptSchema)
