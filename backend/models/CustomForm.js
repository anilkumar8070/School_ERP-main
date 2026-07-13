const mongoose = require('mongoose')

const CustomFormFieldSchema = new mongoose.Schema({
  label: { type: String, required: true },
  type: { type: String, enum: ['text', 'email', 'phone', 'textarea', 'select', 'radio', 'checkbox', 'date', 'file'], default: 'text' },
  required: { type: Boolean, default: false },
  options: [{ type: String }],
  placeholder: { type: String, default: '' }
}, { _id: true })

const CustomFormSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, default: 'General' },
  description: { type: String, default: '' },
  status: { type: String, enum: ['active', 'draft', 'archived'], default: 'active' },
  fields: [CustomFormFieldSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

module.exports = mongoose.models.CustomForm || mongoose.model('CustomForm', CustomFormSchema)
