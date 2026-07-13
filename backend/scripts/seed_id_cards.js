require('dotenv').config()
const mongoose = require('mongoose')
const Student = require('../models/Student')
const IDCard = require('../models/IDCard')

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  console.error('MONGODB_URI not set. Please set MONGODB_URI in your environment.')
  process.exit(1)
}

function makeId(prefix) {
    return prefix + Math.random().toString(36).substring(2, 8).toUpperCase()
}

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('Connected to MongoDB for ID Card Seeding')

    const students = await Student.find({})
    
    if (students.length === 0) {
        console.error('No students found.')
        process.exit(1)
    }

    console.log('--- Generating ID Cards for Students ---')
    let count = 0
    const batchId = `seed_batch_${Date.now()}`
    
    for (const st of students) {
      let latest = await IDCard.findOne({ studentId: st._id })
      if (!latest) {
          let idCode = makeId('IDC_')
          
          let created = false
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              await IDCard.create({
                studentId: st._id,
                type: 'student',
                name: st.name || '',
                fatherName: st.fatherName || '',
                rollNo: st.rollNo || '',
                class: st.class || '',
                medium: st.medium || 'English',
                section: st.section || 'A',
                contact: st.contact || '',
                house: st.house || '',
                houseRole: st.houseRole || '',
                schoolName: 'Demo International School',
                photoUrl: st.avatar || '',
                template: 'default',
                batchId,
                version: 1,
                idCode,
                issueDate: new Date(),
                validUpto: new Date(Date.now() + 365*24*60*60*1000)
              })
              created = true
              break
            } catch (err) {
              if (String(err && err.code) === '11000') {
                idCode = makeId('IDC_')
                continue
              }
              throw err
            }
          }
          if (created) count++
      }
    }

    console.log(`Generated ${count} new ID cards.`)
    process.exit(0)
  } catch (err) {
    console.error('ID Card Seeding Error:', err)
    process.exit(1)
  }
}

seed()
