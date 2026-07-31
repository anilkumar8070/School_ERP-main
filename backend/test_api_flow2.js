const axios = require('axios');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
require('dotenv').config();

async function run() {
  const u = await prisma.user.findFirst({ where: { username: 'Ni@gmail.com' } });
  if (!u) return console.log('User not found in DB');

  const token = jwt.sign({ sub: u.id, username: u.username, role: u.role }, process.env.JWT_SECRET || 'change-this-secret');
  
  try {
    const fRes = await axios.get('http://localhost:4000/api/faculty/me', { headers: { Authorization: 'Bearer ' + token } });
    console.log('Faculty /me:', fRes.data.assignments);
    
    const sRes = await axios.get('http://localhost:4000/api/students?class=12', { headers: { Authorization: 'Bearer ' + token } });
    console.log('Students /students?class=12:', sRes.data.map(s => s.name));
  } catch (err) {
    console.log('Error:', err.response ? err.response.data : err.message);
  }
}
run().finally(() => prisma.$disconnect());
