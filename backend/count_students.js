const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const count = await prisma.student.count();
  const students = await prisma.student.findMany();
  console.log('Total students:', count);
  if(count>0) console.log('First student class:', students[0].class);
}
run().catch(console.error).finally(() => prisma.$disconnect());
