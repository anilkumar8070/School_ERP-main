require('dotenv').config()
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const User = require('../models/User')
const Student = require('../models/Student')
const Faculty = require('../models/Faculty')

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) { console.error('No MONGODB_URI'); process.exit(1) }

const firstNames = ['Aarav','Vihaan','Aditya','Arjun','Sai','Ananya','Diya','Kriti','Neha','Pooja','Rahul','Rohan','Sneha','Tanya','Vikas','Yash','Zara','Kabir','Ishaan','Meera','Riya','Kavya','Dhruv','Aryan','Rishi']
const lastNames  = ['Sharma','Patel','Singh','Kumar','Das','Gupta','Verma','Reddy','Rao','Yadav','Joshi','Chauhan','Thakur','Bose','Nair']

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)] }

async function run() {
  await mongoose.connect(MONGODB_URI)
  console.log('Connected to MongoDB.')
  const hashed = await bcrypt.hash('password123', 10)

  // ──────────────────────────────────────────
  // 1. Add 5 new students to each class 1–8
  // ──────────────────────────────────────────
  const sections = ['A','B','C']
  let added = 0

  for (let cls = 1; cls <= 8; cls++) {
    for (let s = 1; s <= 5; s++) {
      const name    = `${randomItem(firstNames)} ${randomItem(lastNames)}`
      const email   = `student_cls${cls}_${s}@school.com`
      const rollNo  = `C${cls}R${s}`
      const section = randomItem(sections)

      const existU  = await User.findOne({ username: email })
      const existS  = await Student.findOne({ email })
      if (existU || existS) { console.log(`  Skip (exists): ${email}`); continue }

      const student = await Student.create({
        name,
        email,
        class: `${cls}`,
        section,
        rollNo,
        gender: s % 2 === 0 ? 'Female' : 'Male',
        medium: 'English'
      })
      await User.create({ username: email, password: hashed, role: 'student', name })
      added++
      console.log(`  + Student: ${name} | class ${cls} | ${rollNo}`)
    }
  }
  console.log(`\n✅ Added ${added} new students (classes 1–8)\n`)

  // ──────────────────────────────────────────
  // 2. Assign classes to all 20 faculty members
  //    Faculty 1–4  → class 1   Faculty 5–8  → class 2
  //    Faculty 9–12 → class 3   Faculty 13–16 → class 4
  //    Faculty 17–20 → class 5  (rest keep their original classGrade)
  // ──────────────────────────────────────────
  const faculties = await Faculty.find({}).sort({ employeeId: 1 })
  const classAssignments = [
    '1','1','1','1',   // fac 1-4
    '2','2','2','2',   // fac 5-8
    '3','3','3','3',   // fac 9-12
    '4','4','4','4',   // fac 13-16
    '5','5','5','5',   // fac 17-20
  ]
  let facUpdated = 0
  for (let i = 0; i < faculties.length && i < classAssignments.length; i++) {
    const f = faculties[i]
    f.classGrade = classAssignments[i]
    await f.save()
    console.log(`  Faculty: ${f.name} (${f.employeeId}) → class ${classAssignments[i]}`)
    facUpdated++
  }
  console.log(`\n✅ Updated ${facUpdated} faculty class assignments\n`)

  process.exit(0)
}

run().catch(e => { console.error(e); process.exit(1) })
