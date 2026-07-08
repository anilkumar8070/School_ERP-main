const mongoose = require('mongoose')

const FeeHistorySchema = new mongoose.Schema({
  by: String,
  at: { type: Date, default: Date.now },
  term1: Number,
  term2: Number,
  note: String,
  term1DueDate: String,
  term2DueDate: String,
  term1FineMode: { type: String, enum: ['none','per_day','per_month','flat'], default: 'none' },
  term1FineAmount: { type: Number, default: 0 },
  term2FineMode: { type: String, enum: ['none','per_day','per_month','flat'], default: 'none' },
  term2FineAmount: { type: Number, default: 0 }
})

const FeeStructureSchema = new mongoose.Schema({
  class: { type: String, required: true },
  section: { type: String, default: 'ALL' },
  term1: { type: Number, default: 0 },
  term2: { type: Number, default: 0 },
  term1DueDate: { type: String }, // YYYY-MM-DD
  term2DueDate: { type: String }, // YYYY-MM-DD
  term1FineMode: { type: String, enum: ['none','per_day','per_month','flat'], default: 'none' },
  term1FineAmount: { type: Number, default: 0 },
  term2FineMode: { type: String, enum: ['none','per_day','per_month','flat'], default: 'none' },
  term2FineAmount: { type: Number, default: 0 },
  history: [FeeHistorySchema]
}, { timestamps: true })

// Ensure uniqueness per class+section
FeeStructureSchema.index({ class: 1, section: 1 }, { unique: true })

module.exports = mongoose.models.FeeStructure || mongoose.model('FeeStructure', FeeStructureSchema)
