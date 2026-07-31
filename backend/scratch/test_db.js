require('dotenv').config();
const prisma = require('../prisma/client');

async function testConnection() {
  try {
    await prisma.$connect();
    console.log('SUCCESS: Prisma connected to PostgreSQL!');
    const usersCount = await prisma.user.count();
    console.log('User count:', usersCount);
  } catch (err) {
    console.error('FAILED to connect to Prisma:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
