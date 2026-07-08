const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
  name: { type: String },
  fatherName: { type: String },
  disabled: { type: Boolean, default: false },
  // mark if this staff account is an HR user (visible in staff panel but hidden from Staff Management)
  hr: { type: Boolean, default: false },
  contact: { type: String },
  address: { type: String },
  gender: { type: String, enum: ['male','female','other',''], default: '' },
  age: { type: Number, default: null },
  religion: { type: String },
  category: { type: String },
  designation: { type: String },
  avatar: { type: String },
  parentOf: [{ type: String }]
}, { timestamps: true })

module.exports = mongoose.models.User || mongoose.model('User', UserSchema)
