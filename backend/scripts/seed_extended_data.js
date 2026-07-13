require('dotenv').config()
const mongoose = require('mongoose')
const User = require('../models/User')
const Student = require('../models/Student')
const Faculty = require('../models/Faculty')
const Syllabus = require('../models/Syllabus')
const Assignment = require('../models/Assignment')
const Mark = require('../models/Mark')
const Certificate = require('../models/Certificate')
const Timetable = require('../models/Timetable')
const AdmitCard = require('../models/AdmitCard')
const ReportCard = require('../models/ReportCard')

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  console.error('MONGODB_URI not set. Please set MONGODB_URI in your environment.')
  process.exit(1)
}

const subjects = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Computer Science']
const classes = ['9th', '10th', '11th', '12th']

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    console.log('Connected to MongoDB for Extended Data Seeding')

    const students = await Student.find({})
    const faculties = await Faculty.find({})

    if (students.length === 0 || faculties.length === 0) {
        console.error('No students or faculties found. Please run seed_demo_data.js first.')
        process.exit(1)
    }

    const demoFaculty = faculties[0]
    const adminUser = await User.findOne({ role: 'admin' })

    console.log('--- Seeding Assignments & Syllabi & Timetables ---')
    for (const klass of classes) {
        // Timetable
        let tt = await Timetable.findOne({ class: klass })
        if (!tt) {
            await Timetable.create({
                class: klass,
                section: 'A',
                name: `Term 1 Timetable - Class ${klass}`,
                content: JSON.stringify({
                    "Monday": { "Period 1": "Math", "Period 2": "Science", "Period 3": "English" },
                    "Tuesday": { "Period 1": "History", "Period 2": "Physical Education", "Period 3": "Computer Science" },
                    "Wednesday": { "Period 1": "Biology", "Period 2": "Chemistry", "Period 3": "Math" },
                    "Thursday": { "Period 1": "Physics", "Period 2": "English", "Period 3": "Geography" },
                    "Friday": { "Period 1": "Computer Science", "Period 2": "Math", "Period 3": "Art" }
                }),
                mime: 'application/json',
                uploadedBy: demoFaculty._id
            })
        }

        // Syllabus
        let syllabus = await Syllabus.findOne({ class: klass })
        if (!syllabus) {
            await Syllabus.create({
                class: klass,
                subject: 'Science',
                name: `Annual Science Syllabus - Class ${klass}`,
                content: 'Chapter 1: Physics Fundamentals\nChapter 2: Chemistry Basics\nChapter 3: Biology Overview',
                uploadedBy: demoFaculty._id
            })
        }

        // Assignment
        let assignment = await Assignment.findOne({ class: klass })
        if (!assignment) {
             await Assignment.create({
                title: `Midterm Revision Worksheet - ${klass}`,
                description: 'Please complete all 50 objective questions before next week.',
                subject: 'Mathematics',
                class: klass,
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next week
                createdBy: demoFaculty._id
             })
        }
    }

    console.log('--- Seeding Student Specific Records (Marks, Admit/Report Cards, Certificates) ---')
    let count = 0
    for (const student of students) {
        // Marks
        for (const sub of subjects) {
            let mark = await Mark.findOne({ studentId: student._id, subject: sub })
            if (!mark) {
                await Mark.create({
                    class: student.class,
                    section: student.section,
                    studentId: student._id,
                    subject: sub,
                    total: 100,
                    obtained: Math.floor(Math.random() * 40) + 60,
                    term: 'Midterm',
                    createdBy: demoFaculty._id
                })
            }
        }

        // Admit Card
        let admitCard = await AdmitCard.findOne({ recipientId: student._id })
        if (!admitCard) {
             await AdmitCard.create({
                 schoolName: 'Demo International School',
                 examName: 'Midterm Examination 2026',
                 className: student.class,
                 section: student.section,
                 recipientId: student._id,
                 recipientName: student.name,
                 rollNumber: student.rollNo,
                 examRollNumber: `EXM-${student.rollNo}`,
                 studentEmail: student.email,
                 subjects: subjects.map(s => ({ name: s, date: '2026-04-10', time: '10:00 AM' })),
                 instructions: 'Please bring your ID card and report 30 mins before the exam.',
                 dateOfExam: 'April 2026',
                 issuedBy: adminUser ? adminUser._id : null
             })
        }

        // Report Card
        let reportCard = await ReportCard.findOne({ recipientId: student._id })
        if (!reportCard) {
            const rcSubjects = subjects.map(s => ({ name: s, marks: Math.floor(Math.random() * 40) + 60, maxMarks: 100 }))
            const total = rcSubjects.reduce((acc, s) => acc + s.marks, 0)
            const percentage = (total / (subjects.length * 100)) * 100

            await ReportCard.create({
                schoolName: 'Demo International School',
                examName: 'First Term Examination 2025',
                className: student.class,
                section: student.section,
                recipientId: student._id,
                recipientName: student.name,
                recipientEmail: student.email,
                rollNumber: student.rollNo,
                templateType: 'normal',
                subjects: rcSubjects,
                total: total,
                percentage: percentage,
                createdBy: adminUser ? adminUser._id : null
            })
        }

        // Certificate
        let cert = await Certificate.findOne({ recipientId: student._id })
        if (!cert) {
            await Certificate.create({
                schoolName: 'Demo International School',
                title: 'Certificate of Excellence',
                recipientId: student._id,
                recipientType: 'Student',
                recipientName: student.name,
                certificationFor: 'Outstanding Academic Performance',
                dateOfIssue: new Date().toISOString().split('T')[0],
                uploadedBy: adminUser ? adminUser._id : null
            })
        }

        count++
        if (count % 5 === 0) console.log(`Processed ${count}/${students.length} students...`)
    }

    console.log('--- Extended Seeding Complete! ---')
    process.exit(0)
  } catch (err) {
    console.error('Extended Seeding Error:', err)
    process.exit(1)
  }
}

seed()
