const mongoose = require('mongoose');

const TransportReceiptSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  allocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'TransportAllocation' },
  studentName: String,
  studentEmail: String,
  class: String,
  routeId: String,
  stopId: String,
  busId: String,
  routeName: String,
  stopName: String,
  busName: String,
  seatNo: Number,
  amount: Number,
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  pdfUrl: { type: String },
  pdfPath: { type: String },
  rollNo: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('TransportReceipt', TransportReceiptSchema);
