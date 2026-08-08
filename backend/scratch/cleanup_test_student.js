const prisma = require('../prisma/client');

async function cleanup() {
  await prisma.student.deleteMany({ where: { email: 'iitiancraft3@gmail.com' } }).catch(() => {});
  await prisma.user.deleteMany({ where: { username: 'iitiancraft3@gmail.com' } }).catch(() => {});
  console.log('Cleaned up iitiancraft3@gmail.com');
}

cleanup().then(() => process.exit(0)).catch(console.error);
