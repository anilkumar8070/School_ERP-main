require('dotenv').config()
const mongoose = require('mongoose')
const Timetable = require('../models/Timetable')

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI)
  const tts = await Timetable.find({})
  let updated = 0
  for (let t of tts) {
     if (t.content && t.content.includes('"periods":')) {
         const newContent = {
             "Monday": { "Period 1": "Math", "Period 2": "Science", "Period 3": "English" },
             "Tuesday": { "Period 1": "History", "Period 2": "Physical Education", "Period 3": "Computer Science" }
         }
         t.content = JSON.stringify(newContent)
         await t.save()
         updated++
     }
  }
  console.log(`Updated ${updated} timetables`)
  process.exit(0)
}
fix()
