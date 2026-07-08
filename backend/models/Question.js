const mongoose = require('mongoose')

const questionSchema = new mongoose.Schema({
  testId: { type: mongoose.Schema.Types.ObjectId, ref: 'TestSeries' },
  questionText: { type: String, required: true },
  // options remain an array of strings for backward compatibility
  options: { type: [String], required: true },
  // optional image for the question prompt
  questionImage: { type: String, default: '' },
  // optional images for each option (parallel to options by index)
  optionImages: { type: [String], default: [] },
  correctAnswer: { type: String },
  explanation: { type: String },
  marks: { type: Number, default: 1 },
  negativeMarks: { type: Number, default: 0 }
}, { timestamps: true })

module.exports = mongoose.models.Question || mongoose.model('Question', questionSchema)
