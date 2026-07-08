const fs = require('fs')
const path = require('path')

const out = path.join(__dirname, '..', 'demo_students.json')
const classes = Array.from({ length: 12 }, (_, i) => String(i + 1))
const sections = ['A', 'B', 'C', 'D']
const perSection = 40

const students = []

for (const cls of classes) {
  for (const sec of sections) {
    for (let i = 1; i <= perSection; i++) {
      const name = `Student ${cls}${sec}-${i}`
      const email = `student.c${cls}.s${sec}.${i}@example.invalid`
      const rollNo = `${cls}${sec}${i}`
      students.push({ name, email, class: cls, section: sec, rollNo, avatar: '' })
    }
  }
}

fs.writeFileSync(out, JSON.stringify(students, null, 2), 'utf8')
console.log(`Wrote ${students.length} demo students to ${out}`)
