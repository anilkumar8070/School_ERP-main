const mongoose = require('mongoose')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') })
const TestResult = require('../models/TestResult')

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set. Please set MONGODB_URI in environment or .env')
  process.exit(1)
}

async function main() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  console.log('Connected to MongoDB at', MONGODB_URI)

  // Deduplicate by email (keep the most recent submittedAt)
  const dupByEmail = await TestResult.aggregate([
    { $match: { email: { $exists: true, $ne: '' } } },
    { $group: { _id: { test: '$test', email: '$email' }, count: { $sum: 1 }, docs: { $push: { id: '$_id', submittedAt: '$submittedAt' } } } },
    { $match: { count: { $gt: 1 } } }
  ])

  for (const g of dupByEmail) {
    const docs = (g.docs || []).sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0))
    const keep = docs[0] && docs[0].id
    const remove = docs.slice(1).map(d => d.id)
    console.log('Dedup email -> test:', String(g._id.test), 'email:', String(g._id.email), 'keep:', keep, 'remove:', remove)
    if (remove.length) {
      await TestResult.deleteMany({ _id: { $in: remove } })
      console.log('Removed', remove.length, 'documents')
    }
  }

  // Deduplicate by studentId
  const dupByStudent = await TestResult.aggregate([
    { $match: { studentId: { $exists: true, $ne: null } } },
    { $group: { _id: { test: '$test', studentId: '$studentId' }, count: { $sum: 1 }, docs: { $push: { id: '$_id', submittedAt: '$submittedAt' } } } },
    { $match: { count: { $gt: 1 } } }
  ])

  for (const g of dupByStudent) {
    const docs = (g.docs || []).sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0))
    const keep = docs[0] && docs[0].id
    const remove = docs.slice(1).map(d => d.id)
    console.log('Dedup student -> test:', String(g._id.test), 'studentId:', String(g._id.studentId), 'keep:', keep, 'remove:', remove)
    if (remove.length) {
      await TestResult.deleteMany({ _id: { $in: remove } })
      console.log('Removed', remove.length, 'documents')
    }
  }

  console.log('Deduplication complete. Attempting to ensure indexes...')
  try {
    await TestResult.syncIndexes()
    console.log('Indexes synced successfully')
  } catch (idxErr) {
    console.error('Failed to sync indexes:', idxErr.message || idxErr)
  }

  await mongoose.disconnect()
  console.log('Done')
}

main().catch(e => {
  console.error('Error during deduplication:', e)
  process.exit(1)
})
