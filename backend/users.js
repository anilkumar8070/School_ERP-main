const bcrypt = require('bcryptjs')
const crypto = require('crypto')

function demoPassword(envVar, desc) {
  if (process.env[envVar]) return process.env[envVar]
  const gen = crypto.randomBytes(4).toString('hex')
  console.warn(`Demo ${desc} password not set (env ${envVar}). Generated: ${gen}`)
  return gen
}

// Demo users. Passwords come from env variables to avoid hardcoded secrets.
const users = [
  {
    id: 1,
    username: 'admin',
    password: bcrypt.hashSync(demoPassword('DEMO_ADMIN_PASSWORD', 'admin'), 10),
    role: 'admin',
    name: 'Site Administrator'
  },
  {
    id: 2,
    username: 'faculty',
    password: bcrypt.hashSync(demoPassword('DEMO_FACULTY_PASSWORD', 'faculty'), 10),
    role: 'faculty',
    name: 'Faculty Member'
  },
  {
    id: 3,
    username: 'student',
    password: bcrypt.hashSync(demoPassword('DEMO_STUDENT_PASSWORD', 'student'), 10),
    role: 'student',
    name: 'Student User'
  },
  {
    id: 4,
    username: 'parent',
    password: bcrypt.hashSync(demoPassword('DEMO_PARENT_PASSWORD', 'parent'), 10),
    role: 'parent',
    name: 'Parent User'
  }
]

function findByUsername(username) {
  return users.find((u) => u.username === username)
}

function addUser({ username, password, role = 'admin', name = '' }) {
  const id = users.length ? Math.max(...users.map(u => u.id)) + 1 : 1
  const user = { id, username, password, role, name }
  users.push(user)
  return user
}

module.exports = { users, findByUsername, addUser }
