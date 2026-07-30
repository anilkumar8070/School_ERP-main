const jwt = require('jsonwebtoken')

async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization
  let token = null
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1]
  } else if (req.query && req.query.token) {
    // Allow token via query for file downloads opened in a new tab
    token = req.query.token
  } else if (req.headers['x-access-token']) {
    token = req.headers['x-access-token']
  }
  if (!token) {
    return res.status(401).json({ message: 'Missing or invalid Authorization header' })
  }
  try {
    const secret = process.env.JWT_SECRET
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be configured in production')
    }
    const verifiedSecret = secret || 'change-this-secret'
    const payload = jwt.verify(token, verifiedSecret)

    // attach user payload
    req.user = payload

    // check whether the user account has been disabled (if using DB)
    try {
      const User = require('../mongoose_to_prisma').User
      if (payload && payload.sub) {
        const u = await User.findById(payload.sub).catch(() => null)
        if (u && u.disabled) return res.status(403).json({ message: 'Account blocked' })
      }
    } catch (e) {
      // ignore DB check failures and proceed
    }

    next()
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}

function requireRole(roleOrRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' })
    const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles]
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden: insufficient role' })
    next()
  }
}

module.exports = { verifyToken, requireRole }
