const mongoose = require('mongoose');

const TransportAllocationSchema = new mongoose.Schema({
  when: { type: Number, required: true },
  student: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    name: { type: String, required: true },
    email: { type: String, default: '' },
    rollNo: { type: String, default: '' },
    class: { type: String, default: '' }
  },
  routeId: { type: String, required: true },
  stopId: { type: String, required: true },
  busId: { type: String, required: true },
  routeName: { type: String, default: '' },
  stopName: { type: String, default: '' },
  busName: { type: String, default: '' },
  seatNo: { type: Number, required: true },
  fee: {
    amount: { type: Number, required: true },
    option: { type: String, enum: ['add-to-fee', 'pay-now'], required: true }
  },
  paid: { type: Boolean, default: false },
  payments: [{
    amount: { type: Number },
    orderId: { type: String },
    paymentId: { type: String },
    receiptId: { type: String },
    status: { type: String, enum: ['pending','paid'], default: 'pending' },
  }]
}, { timestamps: true });

module.exports = mongoose.model('TransportAllocation', TransportAllocationSchema);
