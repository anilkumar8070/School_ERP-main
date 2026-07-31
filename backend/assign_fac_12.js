const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const fac = await prisma.faculty.findFirst({ where: { email: 'Ni@gmail.com' } });
  if (!fac) return console.log('Faculty not found');
  const assignments = [{ class: '12', section: 'A', isClassTeacher: true }, { class: '12', section: 'ALL', isClassTeacher: true }];
  await prisma.faculty.update({ where: { id: fac.id }, data: { assignments } });
  console.log('Updated faculty assignments to Class 12');
}
run().catch(console.error).finally(() => prisma.$disconnect());
