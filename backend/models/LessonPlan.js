const mongoose = require('mongoose')

const LessonPlanSchema = new mongoose.Schema({
  facultyUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' },
  teacherName: { type: String, default: '' },
  class: { type: String, required: true },
  section: { type: String, default: 'ALL' },
  subject: { type: String, required: true },
  title: { type: String, required: true },
  lessonDate: { type: String, required: true },
  durationMinutes: { type: Number, default: 40 },
  objectives: { type: String, default: '' },
  materials: { type: String, default: '' },
  activities: { type: String, default: '' },
  homework: { type: String, default: '' },
  assessment: { type: String, default: '' },
  status: { type: String, enum: ['planned', 'in_progress', 'completed'], default: 'planned' },
  notes: { type: String, default: '' }
}, { timestamps: true })

LessonPlanSchema.index({ facultyUserId: 1, lessonDate: -1 })
LessonPlanSchema.index({ class: 1, section: 1, subject: 1 })

module.exports = mongoose.models.LessonPlan || mongoose.model('LessonPlan', LessonPlanSchema)
