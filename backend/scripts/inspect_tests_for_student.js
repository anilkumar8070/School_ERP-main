// Run with: node scripts/inspect_tests_for_student.js student@example.com
require('dotenv').config()
const mongoose = require('mongoose')
const TestSeries = require('../models/TestSeries')
const Student = require('../models/Student')

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set. Please set MONGODB_URI in environment or .env')
  process.exit(1)
}

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Usage: node scripts/inspect_tests_for_student.js student@example.com')
    process.exit(2)
  }
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  console.log('Connected to', MONGODB_URI)
  try {
    const student = await Student.findOne({ email }).lean().catch(() => null)
    console.log('\nStudent record:')
    if (!student) console.log('  (no student found for', email + ')')
    else console.log(JSON.stringify(student, null, 2))

    const now = new Date()
    const tests = await TestSeries.find().lean()
    console.log('\nAll tests (found ' + (tests.length) + '):')
    for (const t of tests) {
      const targetsAll = !t.classes || (Array.isArray(t.classes) && t.classes.length === 0) || !t.classes.length
      const matchesClass = student && student.class && Array.isArray(t.classes) && t.classes.includes(student.class)
      const matchesSection = student && student.section && Array.isArray(t.sections) && t.sections.includes(student.section)
      const matches = targetsAll || matchesClass || matchesSection
      console.log('---')
      console.log('id:', t._id)
      console.log('title:', t.title)
      console.log('classes:', JSON.stringify(t.classes))
      console.log('sections:', JSON.stringify(t.sections))
      console.log('start:', t.start)
      console.log('durationMinutes:', t.durationMinutes)
      console.log('visibleToStudent:', matches)
    }

    // Also show which tests the server would return (mimic server logic)
    console.log('\nTests that would be returned by /api/tests/my for this student:')
    const orClauses = []
    orClauses.push({ classes: { $size: 0 } })
    orClauses.push({ classes: { $exists: false } })
    if (student) {
      orClauses.push({ classes: student.class })
      orClauses.push({ classes: { $in: [student.class] } })
      if (student.section) {
        orClauses.push({ sections: { $in: [student.section] } })
        orClauses.push({ sections: student.section })
      }
    }
    const q = { $or: orClauses }
    const visible = await TestSeries.find(q).sort({ start: 1 }).lean()
    console.log('Found', visible.length, 'visible tests:')
    visible.forEach(t => console.log(' -', t._id, t.title))
  } catch (err) {
    console.error('Error:', err && err.message)
  } finally {
    mongoose.disconnect()
    process.exit(0)
  }
}

main()
