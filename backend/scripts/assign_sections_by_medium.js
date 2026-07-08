#!/usr/bin/env node
/**
 * Script: assign_sections_by_medium.js
 *
 * Usage:
 *  node assign_sections_by_medium.js           # dry-run report
 *  node assign_sections_by_medium.js --capacity=40   # dry-run with per-section capacity
 *  node assign_sections_by_medium.js --all-english --commit --capacity=40
 *
 * Options:
 *  --all-english   : set every student's `medium` to 'English' before assigning sections
 *  --commit        : actually write changes to the database; without it the script is a dry-run
 *  --capacity=N    : (optional) per-section capacity used to compute remaining slots (default 40)
 */

require('dotenv').config()
const mongoose = require('mongoose')
const path = require('path')
const Student = require(path.join(__dirname, '..', 'models', 'Student'))

const ARGS = process.argv.slice(2)
const ALL_ENGLISH = ARGS.includes('--all-english')
const COMMIT = ARGS.includes('--commit')
const capArg = ARGS.find(a => a.startsWith('--capacity='))
const PER_SECTION_CAP = capArg ? Number(capArg.split('=')[1] || 40) : 40

const SECTION_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not set in environment')
    process.exit(1)
  }

  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  console.log('Connected to MongoDB')

  try {
    // gather classes present
    const classes = await Student.distinct('class', { class: { $exists: true, $ne: '' } })
    if (!classes || classes.length === 0) {
      console.log('No classes found in students collection')
      return
    }

    for (const cls of classes.sort()) {
      const students = await Student.find({ class: cls }).lean()
      const total = students.length
      console.log(`\nClass ${cls}: ${total} students`)

      // If --all-english is requested, treat every student as English
      const mediumsSet = new Set()
      for (const s of students) {
        if (ALL_ENGLISH) mediumsSet.add('English')
        else mediumsSet.add((s.medium || '').trim() || 'English')
      }
      const mediums = Array.from(mediumsSet).filter(Boolean).sort()
      if (mediums.length === 0) mediums.push('English')

      // map mediums to section labels deterministically
      const mapping = {}
      for (let i = 0; i < mediums.length; i++) {
        const m = mediums[i]
        const label = SECTION_LABELS[i] || SECTION_LABELS[SECTION_LABELS.length - 1]
        mapping[m] = label
      }

      // compute counts per medium -> section
      const counts = {}
      for (const m of mediums) counts[m] = 0
      for (const s of students) {
        const m = ALL_ENGLISH ? 'English' : (s.medium || '').trim() || 'English'
        if (!(m in counts)) counts[m] = 0
        counts[m]++
      }

      // Report mapping and counts and remaining capacity per section
      console.log('Medium -> Section mapping:')
      for (const m of Object.keys(mapping)) {
        const sec = mapping[m]
        const cnt = counts[m] || 0
        const remaining = PER_SECTION_CAP - cnt
        console.log(`  ${m} -> Section ${sec} : ${cnt} students (capacity ${PER_SECTION_CAP}, remaining ${remaining >= 0 ? remaining : 0})`)
      }

      // If commit: perform updates
      if (COMMIT) {
        if (ALL_ENGLISH) {
          // set all students in this class to medium English and section mapping['English']
          const sec = mapping['English'] || SECTION_LABELS[0]
          const res = await Student.updateMany({ class: cls }, { $set: { medium: 'English', section: sec } })
          console.log(`  [COMMIT] Updated ${res.modifiedCount || res.nModified || res.n || 0} documents to medium=English, section=${sec}`)
        } else {
          for (const m of Object.keys(mapping)) {
            const sec = mapping[m]
            const q = { class: cls, $or: [{ medium: m }, { medium: m } ] }
            const res = await Student.updateMany({ class: cls, medium: m }, { $set: { section: sec } })
            console.log(`  [COMMIT] Updated ${res.modifiedCount || res.nModified || res.n || 0} documents with medium=${m} -> section=${sec}`)
          }
        }
      } else {
        console.log('  (dry-run) Run with --commit to apply changes')
      }
    }
  } catch (e) {
    console.error('Script failed:', e && e.message)
  } finally {
    await mongoose.disconnect()
    console.log('\nDisconnected from MongoDB')
  }
}

main().catch(err => { console.error(err); process.exit(1) })
