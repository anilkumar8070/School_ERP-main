// Run this script with: node backend/scripts/set_all_students_medium_to_english.js
// It will set medium='English' for students whose medium is missing or empty.

const mongoose = require('mongoose')
const Student = require('../models/Student')
require('dotenv').config()

async function run() {
  // Allow passing URI as first CLI arg or via MONGODB_URI in env/.env
  const cliUri = process.argv[2]
  const uri = cliUri || process.env.MONGODB_URI
  if (!uri) {
    console.error('\nMONGODB_URI not set. Provide it via environment or as a CLI arg:')
    console.error('  $ node scripts/set_all_students_medium_to_english.js "mongodb://user:pass@host:27017/dbname"')
    console.error('\nOr create a `.env` file in `backend/` containing:\n  MONGODB_URI=your-mongodb-uri\n')
    process.exit(1)
  }

  // Try connecting and show a friendly error on failure
  try {
    await mongoose.connect(uri)
    console.log('Connected to DB')
  } catch (err) {
    console.error('\nFailed to connect to MongoDB.')
    // Try to show a helpful hint when the URI looks malformed
    if (err && err.cause && err.cause.input) {
      console.error('Invalid connection string detected:', err.cause.input)
    } else if (err && err.message) {
      console.error('Error:', err.message)
    } else {
      console.error(String(err))
    }
    console.error('\nMake sure `MONGODB_URI` is a valid MongoDB connection string, for example:')
    console.error('  mongodb://username:password@localhost:27017/yourdb')
    console.error('  mongodb+srv://username:password@cluster0.mongodb.net/yourdb')
    process.exit(1)
  }

  try {
    const res = await Student.updateMany({ $or: [ { medium: { $exists: false } }, { medium: '' } ] }, { $set: { medium: 'English' } })
    console.log('Matched:', res.matchedCount ?? res.n ?? 0)
    console.log('Modified:', res.modifiedCount ?? res.nModified ?? 0)
  } catch (e) {
    console.error('Failed to update:', e && e.message)
  } finally {
    try { await mongoose.disconnect() } catch (e) {}
    console.log('Disconnected')
  }
}

run()
