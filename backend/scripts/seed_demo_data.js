require('dotenv').config()
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const User = require('../models/User')
const Student = require('../models/Student')
const Faculty = require('../models/Faculty')
const Receipt = require('../models/Receipt')
const TestResult = require('../models/TestResult')
const TestSeries = require('../models/TestSeries')
const Notice = require('../models/Notice')

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  console.error('MONGODB_URI not set. Please set MONGODB_URI in your environment.')
  process.exit(1)
}

const firstNames = ['Aarav', 'Vihaan', 'Aditya', 'Arjun', 'Sai', 'Ananya', 'Diya', 'Kriti', 'Neha', 'Pooja', 'Rahul', 'Rohan', 'Sneha', 'Tanya', 'Vikas', 'Yash', 'Zara', 'Kabir', 'Ishaan', 'Meera', 'Riya', 'Kavya', 'Dhruv', 'Aryan', 'Rishi', 'Karan']
const lastNames = ['Sharma', 'Patel', 'Singh', 'Kumar', 'Das', 'Gupta', 'Verma', 'Reddy', 'Rao', 'Yadav', 'Joshi', 'Chauhan', 'Thakur', 'Bose', 'Nair']

const classes = ['9th', '10th', '11th', '12th']
const subjects = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Computer Science']

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomName() {
  return `${randomItem(firstNames)} ${randomItem(lastNames)}`
}

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    console.log('Connected to MongoDB')

    const hashed = await bcrypt.hash('password123', 10)

    console.log('--- Clearing old Demo Data (Students, Faculty, Receipts) ---')
    // We will only delete those that look like they could be from our seed script to be safe
    // But since the user wants 20 new ones, let's just create them without deleting anything for now
    // to avoid deleting real data if they have any.

    console.log('--- Creating 20 Faculty Profiles ---')
    const createdFaculties = []
    for (let i = 1; i <= 20; i++) {
      const name = randomName()
      const email = `faculty${i}@demo.com`
      const subject = randomItem(subjects)
      
      const existingUser = await User.findOne({ username: email })
      const existingFaculty = await Faculty.findOne({ email: email })
      if (!existingUser && !existingFaculty) {
        const faculty = await Faculty.create({
          name,
          email,
          employeeId: `EMP${1000 + i}`,
          subject,
          contact: `9876543${String(i).padStart(3, '0')}`,
          experience: `${Math.floor(Math.random() * 10) + 1} Years`,
          classGrade: randomItem(classes)
        })
        createdFaculties.push(faculty)
        
        await User.create({
          username: email,
          password: hashed,
          role: 'faculty',
          name,
        })
      }
    }
    console.log(`Created ${createdFaculties.length} faculty. Login: faculty1@demo.com .. faculty20@demo.com`)

    console.log('--- Creating Demo Test Series ---')
    let demoTest = await TestSeries.findOne({ title: 'Demo Midterm Evaluation' })
    if (!demoTest) {
      demoTest = await TestSeries.create({
        title: 'Demo Midterm Evaluation',
        subject: 'Mathematics',
        type: 'internal',
        classes: classes,
        start: new Date(),
        durationMinutes: 120,
        description: 'Auto-generated test series for demo purposes.'
      })
    }

    console.log('--- Creating 20 Student Profiles ---')
    const createdStudents = []
    for (let i = 1; i <= 20; i++) {
        const name = randomName()
        const email = `student${i}@demo.com`
        const klass = randomItem(classes)
        
        const existingUser = await User.findOne({ username: email })
        const existingStudent = await Student.findOne({ email: email })
        if (!existingUser && !existingStudent) {
          const student = await Student.create({
            name,
            email,
            class: klass,
            section: randomItem(['A', 'B', 'C']),
            rollNo: `R${100 + i}`,
            gender: randomItem(['Male', 'Female']),
            medium: 'English'
          })
          createdStudents.push(student)
          
          await User.create({
            username: email,
            password: hashed,
            role: 'student',
            name,
          })

          // Add a dummy receipt for the student
          await Receipt.create({
            studentId: student._id,
            studentName: student.name,
            studentEmail: student.email,
            amount: 5000 + Math.floor(Math.random() * 15000),
            purpose: 'Tuition Fee Term 1',
            status: 'completed'
          })

          // Add a dummy test result connected to our demoTest
          await TestResult.create({
              test: demoTest._id,
              studentId: student._id,
              name: student.name,
              email: student.email,
              class: student.class,
              section: student.section,
              rollNo: student.rollNo,
              score: Math.floor(Math.random() * 40) + 60,
              total: 100,
              percentage: Math.floor(Math.random() * 40) + 60,
              submittedAt: new Date()
          })
        }
    }
    console.log(`Created ${createdStudents.length} students. Login: student1@demo.com .. student20@demo.com`)

    console.log('--- Creating Notice ---')
    await Notice.create({
        title: 'Welcome to the School ERP Demo',
        content: 'This is a sample notice for all students and faculty.',
        userTypes: ['student', 'faculty', 'parent'],
        date: new Date()
    })

    console.log('Seeding Complete! All passwords are: password123')
    process.exit(0)
  } catch (err) {
    console.error('Seeding Error:', err)
    process.exit(1)
  }
}

seed()
