const mongoose = require('mongoose')

const ResourceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: { type: String },
  class: { type: String },
  filename: { type: String, required: true },
  originalname: { type: String },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

module.exports = mongoose.model('Resource', ResourceSchema)
