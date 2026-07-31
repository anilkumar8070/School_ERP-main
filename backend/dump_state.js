const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const fac = await prisma.faculty.findFirst({ where: { email: 'Ni@gmail.com' } });
  if (!fac) return console.log('Faculty not found');
  console.log('Faculty assignments:', JSON.stringify(fac.assignments, null, 2));
  
  const students = await prisma.student.findMany();
  console.log('Students:', JSON.stringify(students.map(s => ({ id: s.id, class: s.class, section: s.section, name: s.name })), null, 2));
}
run().catch(console.error).finally(() => prisma.$disconnect());
