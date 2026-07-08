require('dotenv').config()
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const User = require('../models/User')
const Faculty = require('../models/Faculty')

async function fix() {
  try {
    if (!process.env.MONGODB_URI) throw new Error('No MONGODB_URI')
    await mongoose.connect(process.env.MONGODB_URI)
    
    console.log('Connected to DB. Fixing Faculty User accounts...')
    const faculties = await Faculty.find({})
    const hashed = await bcrypt.hash('password123', 10)
    let fixed = 0

    for (const fac of faculties) {
      if (!fac.email) continue
      const u = await User.findOne({ username: fac.email })
      if (!u) {
        await User.create({
          username: fac.email,
          password: hashed,
          role: 'faculty',
          name: fac.name
        })
        fixed++
        console.log(`Created missing User for ${fac.email}`)
      } else {
        // Just to be absolutely safe, let's reset the password to password123
        u.password = hashed
        await u.save()
        console.log(`Reset password for ${fac.email}`)
        fixed++
      }
    }
    
    console.log(`Fixed/Reset ${fixed} Faculty User accounts. password is password123`)
    process.exit(0)
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
}

fix()
