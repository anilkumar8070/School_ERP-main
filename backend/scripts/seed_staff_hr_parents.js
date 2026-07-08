// This script adds all required data via the backend API (same as admin dashboard):
// 1. Remaining staff members (skips already-added ones)
// 2. HR records for all staff
// 3. Parents linked to every student
require('dotenv').config()
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const User = require('../models/User')
const Student = require('../models/Student')

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) { console.error('No MONGODB_URI'); process.exit(1) }

// Staff to add
const STAFF_LIST = [
  { name: 'Rajesh Kumar', fatherName: 'Suresh Kumar', email: 'staff1@school.com', contact: '9811001001', designation: 'Office Clerk', address: 'Administration' },
  { name: 'Sunita Sharma', fatherName: 'Mohan Sharma', email: 'staff2@school.com', contact: '9811001002', designation: 'Lab Assistant', address: 'Science' },
  { name: 'Amit Verma', fatherName: 'Ramesh Verma', email: 'staff3@school.com', contact: '9811001003', designation: 'Librarian', address: 'Library' },
  { name: 'Priya Singh', fatherName: 'Vijay Singh', email: 'staff4@school.com', contact: '9811001004', designation: 'Accountant', address: 'Finance' },
  { name: 'Deepak Patel', fatherName: 'Kiran Patel', email: 'staff5@school.com', contact: '9811001005', designation: 'Peon', address: 'General' },
  // HR records (added as staff with designation HR Manager)
  { name: 'Meena Agarwal', fatherName: 'Ramesh Agarwal', email: 'hr1@school.com', contact: '9811002001', designation: 'HR Manager', address: 'Human Resources' },
  { name: 'Suresh Bhatia', fatherName: 'Mohan Bhatia', email: 'hr2@school.com', contact: '9811002002', designation: 'HR Executive', address: 'Human Resources' },
]

async function run() {
  await mongoose.connect(MONGODB_URI)
  console.log('Connected to MongoDB.')

  const hashed = await bcrypt.hash('password123', 10)

  // ── 1. Add Staff + HR ─────────────────────────────────────
  console.log('\n--- Adding Staff and HR Members ---')
  for (const s of STAFF_LIST) {
    const exists = await User.findOne({ username: s.email })
    if (exists) { console.log('  Skip (already exists):', s.email); continue }
    await User.create({
      username: s.email,
      password: hashed,
      role: 'staff',
      name: s.name,
      contact: s.contact || '',
      address: s.address || '',
      fatherName: s.fatherName || '',
      designation: s.designation || ''
    })
    console.log('  + Added:', s.name, '|', s.designation, '|', s.email)
  }

  // ── 2. Add Parents for every student ─────────────────────
  console.log('\n--- Adding Parents for All Students ---')
  const allStudents = await Student.find({}).lean()
  let parentsAdded = 0
  for (let i = 0; i < allStudents.length; i++) {
    const student = allStudents[i]
    const idx = i + 1
    const parentEmail = `parent${idx}@school.com`
    const parentName = `${student.name.split(' ')[1] || 'Kumar'} Sr.`

    // Check if parent already exists
    const existingParent = await User.findOne({ username: parentEmail })
    if (existingParent) {
      // Just ensure parentOf is linked
      if (!existingParent.parentOf || !existingParent.parentOf.includes(String(student._id))) {
        existingParent.parentOf = [...(existingParent.parentOf || []), String(student._id)]
        await existingParent.save()
        console.log('  Linked existing parent to:', student.name)
      } else {
        console.log('  Skip (parent exists & linked):', parentEmail)
      }
      continue
    }

    await User.create({
      username: parentEmail,
      password: hashed,
      role: 'parent',
      name: parentName,
      parentOf: [String(student._id)]
    })
    parentsAdded++
    console.log(`  + Parent: ${parentName} (${parentEmail}) -> ${student.name}`)
  }

  console.log(`\n✅ Added ${parentsAdded} parent accounts`)
  console.log('\nAll passwords: password123')
  console.log('\nStaff login emails: staff1@school.com ... staff5@school.com')
  console.log('HR login emails: hr1@school.com, hr2@school.com')
  console.log('Parent login emails: parent1@school.com ... parent' + allStudents.length + '@school.com')

  process.exit(0)
}

run().catch(e => { console.error(e); process.exit(1) })
