const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ where: { role: 'faculty' }});
  console.log('Faculty users:', users);
  
  const faculties = await prisma.faculty.findMany();
  console.log('Faculty records:', faculties);
}

main().finally(() => prisma.$disconnect());
