const mongoose = require('mongoose')

const HostelAllocationSchema = new mongoose.Schema({
  when: { type: Number, required: true },
  hostelId: { type: String, required: true },
  floorNo: { type: Number, required: true },
  roomNo: { type: Number, required: true },
  bedIndex: { type: Number, required: true },
  student: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    name: { type: String, required: true },
    email: { type: String, default: '' },
    rollNo: { type: String, default: '' },
    class: { type: String, default: '' },
    idCardCode: { type: String, default: '' }
  },
  bedType: { type: String, required: true },
  fee: {
    amount: { type: Number, required: true },
    parts: { type: Number, required: true },
    perPart: { type: Number, required: true },
    option: { type: String, enum: ['add-to-fee', 'pay-now'], required: true }
  },
  paid: { type: Boolean, default: false },
  payments: [{
    partIndex: { type: Number },
    amount: { type: Number },
    orderId: { type: String },
    paymentId: { type: String },
    receiptId: { type: String },
    status: { type: String, enum: ['pending','paid'], default: 'pending' },
  }]
}, { timestamps: true })

module.exports = mongoose.model('HostelAllocation', HostelAllocationSchema)
