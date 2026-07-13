const mongoose = require('mongoose')

const ALLOWED_HOUSES = ['Blue', 'Green', 'Red', 'Yellow']

const StudentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true },
  class: { type: String },
  section: { type: String },
  rollNo: { type: String },
  // Academic stream for classes 11-12 (e.g., PCM, PCB, Commerce, Arts)
  stream: { type: String, default: '' },
  avatar: { type: String }
  ,
  blocked: { type: Boolean, default: false }
  ,
  // Demographics
  gender: { type: String, enum: ['Male', 'Female', 'Other', ''], default: '' },
  // Medium of instruction (language)
  medium: { type: String, enum: ['Hindi','English','Bengali','Tamil','Telugu','Marathi','Gujarati','Urdu','Kannada','Malayalam',''], default: 'English' },
  category: { type: String, enum: ['General', 'OBC', 'SC', 'ST', 'EWS', 'Other', ''], default: '' },
  religion: { type: String, enum: ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Other', ''], default: '' },
  
  // House assignment for hostel/sports etc.
  house: { type: String, enum: ALLOWED_HOUSES },
  // Optional role within the house (e.g., Captain, Leader)
  houseRole: { type: String, default: '' },
  // One-time code a parent can use to link to this student
  parentAccessCode: { type: String },
  
  // Assigned fees by admin (optional). Each entry represents a fee assigned to this student.
  assignedFees: [{
    term: { type: String },
    amount: { type: Number },
    note: { type: String },
    by: { type: String },
    assignedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true })

// Auto-assign a valid house before validation if missing/invalid.
// Balances houses within the same class by choosing the least populated.
StudentSchema.pre('validate', async function(next) {
  try {
    const current = this.house && String(this.house)
    if (current && ALLOWED_HOUSES.includes(current)) return next()

    const klass = this.class ? String(this.class) : ''
    // If class is not set yet, fallback to random assignment
    if (!klass) {
      this.house = ALLOWED_HOUSES[Math.floor(Math.random() * ALLOWED_HOUSES.length)]
      return next()
    }

    const counts = []
    for (const h of ALLOWED_HOUSES) {
      try {
        const c = await this.constructor.countDocuments({ class: klass, house: h })
        counts.push(c)
      } catch (e) {
        counts.push(Number.MAX_SAFE_INTEGER)
      }
    }
    const min = Math.min(...counts)
    const candidates = ALLOWED_HOUSES.filter((_, idx) => counts[idx] === min)
    this.house = candidates[Math.floor(Math.random() * candidates.length)]
    return next()
  } catch (e) {
    // On any unexpected error, assign randomly to ensure validation passes
    this.house = ALLOWED_HOUSES[Math.floor(Math.random() * ALLOWED_HOUSES.length)]
    return next()
  }
})

// Ensure unique index on email
StudentSchema.index({ email: 1 }, { unique: true, sparse: true })

module.exports = mongoose.models.Student || mongoose.model('Student', StudentSchema)
