const mongoose = require('mongoose')

const FormQuerySchema = new mongoose.Schema({
  formId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource' },
  formTitle: { type: String },
  name: { type: String, required: true },
  email: { type: String, required: true },
  contact: { type: String },
  description: { type: String },
  formType: { type: String, enum: ['resource', 'custom'], default: 'resource' },
  responses: { type: mongoose.Schema.Types.Mixed },
  attachments: [{
    fieldId: String,
    fieldLabel: String,
    filename: String,
    originalname: String
  }],
  filename: { type: String },
  originalname: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

module.exports = mongoose.model('FormQuery', FormQuerySchema)
