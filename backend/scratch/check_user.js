require('dotenv').config()
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const User = require('../models/User')

async function run() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI not set')
    process.exit(1)
  }

  try {
    await mongoose.connect(uri)
    console.log('Connected to MongoDB')

    const username = 'admin@gmail.com'
    const password = 'Admin@IITianCraft'

    const user = await User.findOne({ username: { $regex: `^${username}$`, $options: 'i' } }).lean()
    if (!user) {
      console.log(`User ${username} NOT FOUND`)
      const allUsers = await User.find({}, { username: 1 }).limit(10).lean()
      console.log('Existing users (first 10):', allUsers.map(u => u.username))
    } else {
      console.log(`User ${username} found. Hashed password: ${user.password}`)
      const matches = await bcrypt.compare(password, user.password)
      console.log(`Password matches: ${matches}`)
    }

    process.exit(0)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

run()
