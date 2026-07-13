const mongoose = require('mongoose')

const ClassSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  subjects: { type: [String], default: [] }
}, { timestamps: true })

module.exports = mongoose.models.Class || mongoose.model('Class', ClassSchema)
