const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const fac = await prisma.faculty.findFirst({ where: { email: 'Ni@gmail.com' } });
  if (!fac) return console.log('Faculty not found');
  const assignments = [{ class: '1', sections: ['ALL'], isClassTeacher: true }];
  await prisma.faculty.update({ where: { id: fac.id }, data: { assignments } });
  console.log('Updated faculty assignments');
}
run().catch(console.error).finally(() => prisma.$disconnect());
