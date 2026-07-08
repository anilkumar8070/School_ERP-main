const mongoose = require('mongoose')

const SalaryPaymentSchema = new mongoose.Schema({
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
  facultyName: String,
  facultyEmail: String,
  month: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  receiptNo: String,
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
}, { timestamps: true })

module.exports = mongoose.models.SalaryPayment || mongoose.model('SalaryPayment', SalaryPaymentSchema)
