require('dotenv').config()
const mongoose = require('mongoose')
const path = require('path')
const fs = require('fs')

const Student = require('../models/Student')

const MONGODB_URI = process.env.MONGODB_URI || ''

async function connect(uri) {
  if (!uri) throw new Error('MONGODB_URI not set in environment')
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
    console.log('Connected to MongoDB')
  } catch (err) {
    console.warn('Initial connection failed:', err.message)
    if (uri.includes('localhost')) {
      const alt = uri.replace('localhost', '127.0.0.1')
      console.log('Retrying with', alt)
      await mongoose.connect(alt, { useNewUrlParser: true, useUnifiedTopology: true })
      console.log('Connected to MongoDB (via 127.0.0.1)')
    } else {
      throw err
    }
  }
}

async function importStudents() {
  const file = path.join(__dirname, '..', 'demo_students.json')
  if (!fs.existsSync(file)) {
    console.error('Demo file not found:', file)
    process.exit(1)
  }
  const raw = fs.readFileSync(file, 'utf8')
  const students = JSON.parse(raw)
  console.log('Loaded', students.length, 'demo students')

  await connect(MONGODB_URI)

  let inserted = 0
  let skipped = 0

  for (const s of students) {
    try {
      // skip if email or rollNo already exists
      const exists = await Student.findOne({ $or: [{ email: s.email }, { rollNo: s.rollNo }] }).lean()
      if (exists) {
        skipped++
        continue
      }
      await Student.create(s)
      inserted++
    } catch (err) {
      console.error('Failed to insert student', s.email, err.message)
    }
  }

  console.log(`Inserted: ${inserted}, Skipped: ${skipped}`)
  await mongoose.disconnect()
  console.log('Done')
}

importStudents().catch(err => { console.error(err); process.exit(1) })
