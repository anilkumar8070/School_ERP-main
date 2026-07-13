const jwt = require('jsonwebtoken')
try {
  const token = jwt.sign({ sub: 123 }, 'secret', { expiresIn: '1000hrs' })
  console.log('Token signed successfully:', token)
} catch (e) {
  console.error('Error signing token:', e.message)
}
