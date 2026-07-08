require('dotenv').config()
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const User = require('./models/User')

async function run() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI not set in .env — this script requires a running MongoDB')
    process.exit(1)
  }

  const args = process.argv.slice(2)
  const username = args[0] || process.env.CREATE_ADMIN_USERNAME || 'admin'
  const password = args[1] || process.env.CREATE_ADMIN_PASSWORD
  const name = args[2] || process.env.CREATE_ADMIN_NAME || 'Administrator'
  if (!password) {
    console.error('Admin password not provided. Supply as first CLI arg or set CREATE_ADMIN_PASSWORD in environment.')
    process.exit(2)
  }

  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
    console.log('Connected to MongoDB')

    const hashed = await bcrypt.hash(password, 10)
    const existing = await User.findOne({ username })
    if (existing) {
      existing.password = hashed
      existing.role = 'admin'
      existing.name = name
      await existing.save()
      console.log(`Updated existing admin user: ${username}`)
    } else {
      await User.create({ username, password: hashed, role: 'admin', name })
      console.log(`Created admin user: ${username}`)
    }

    console.log('Done. You can now login at the frontend admin login page.')
    process.exit(0)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(2)
  }
}

run()
