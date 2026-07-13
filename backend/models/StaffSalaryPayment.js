const mongoose = require('mongoose')

const StaffSalaryPaymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  staffName: String,
  staffEmail: String,
  month: { type: String, required: true },
  basic: { type: Number, default: 0 },
  allowances: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  paymentMethod: { type: String, default: '' },
  paymentDate: Date,
  notes: String,
  receiptNo: String,
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
}, { timestamps: true })

module.exports = mongoose.models.StaffSalaryPayment || mongoose.model('StaffSalaryPayment', StaffSalaryPaymentSchema)
