require('dotenv').config()
const mongoose = require('mongoose')
const Faculty = require('../models/Faculty')

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const faculties = await Faculty.find({})
  let updated = 0
  for (const f of faculties) {
    const cls = String(f.classGrade || '').trim()
    if (!cls) continue
    if (!f.assignments || f.assignments.length === 0) {
      f.assignments = [{
        class: cls,
        section: '',
        subjects: f.subject ? [f.subject] : [],
        isClassTeacher: true
      }]
      await f.save()
      updated++
      console.log('Updated:', f.name, '-> class', cls)
    } else {
      console.log('Already has assignments:', f.name, f.assignments[0].class)
    }
  }
  console.log('Done. Updated', updated, 'faculty records.')
  process.exit(0)
}).catch(e => { console.error(e); process.exit(1) })
