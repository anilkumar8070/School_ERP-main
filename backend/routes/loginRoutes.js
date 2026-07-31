const prisma = require('../prisma/client');
const express = require('express');

module.exports = function(helpers) {
  const router = express.Router();
  const { bcrypt, jwt, findByUsername } = helpers;

  router.post("/", async (req, res) => {
    const { username, password } = req.body || {};
    
    if (!username || !password) {
      return res.status(400).json({ message: 'username and password required' });
    }

    try {
      let user = await prisma.user.findFirst({
        where: {
          username: {
            equals: username,
            mode: 'insensitive'
          }
        }
      });

      // No fallback required since Prisma will return the user or null
      if (!user) {
        console.log(`Login failed: user ${username} not found`);
        return res.status(401).json({ message: 'User not found' });
      }

      if (user.disabled) {
        return res.status(403).json({ message: 'Account blocked' });
      }

      const passwordMatches = await bcrypt.compare(password, user.password);
      if (!passwordMatches) {
        console.log(`Login failed: password mismatch for ${username}`);
        return res.status(401).json({ message: 'Incorrect password' });
      }

      const payload = {
        sub: user.id,
        username: user.username,
        role: user.role,
        name: user.name
      };

      const secret = process.env.JWT_SECRET || 'change-this-secret';
      const token = jwt.sign(payload, secret, {
        expiresIn: process.env.JWT_EXPIRES || '2h'
      });

      let redirect = '/';
      if (user.role === 'admin') redirect = '/admin-dashboard';
      if (user.role === 'faculty') redirect = '/faculty-dashboard';
      if (user.role === 'student') redirect = '/student-dashboard';
      if (user.role === 'parent') redirect = '/parents-dashboard';
      if (user.role === 'staff') redirect = '/staff-dashboard';

      return res.json({ token, role: user.role, redirect });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  return router;
};
