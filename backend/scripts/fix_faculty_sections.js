require('dotenv').config()
const mongoose = require('mongoose')
const Faculty = require('../models/Faculty')

// For each faculty, update their assignments to include sections A, B, C
// so they can take attendance for any section in their class

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const faculties = await Faculty.find({})
  let updated = 0
  for (const f of faculties) {
    const cls = String(f.classGrade || '').trim()
    if (!cls) continue
    // Set to class teacher (all sections) with A, B, C listed
    f.assignments = [{
      class: cls,
      section: 'A',
      subjects: f.subject ? [f.subject] : [],
      isClassTeacher: false
    }, {
      class: cls,
      section: 'B',
      subjects: f.subject ? [f.subject] : [],
      isClassTeacher: false
    }, {
      class: cls,
      section: 'C',
      subjects: f.subject ? [f.subject] : [],
      isClassTeacher: true  // class teacher flag means access to all sections
    }]
    await f.save()
    updated++
    console.log('Updated:', f.name, '-> class', cls, 'sections A, B, C')
  }
  console.log('Done. Updated', updated, 'faculty records.')
  process.exit(0)
}).catch(e => { console.error(e); process.exit(1) })
