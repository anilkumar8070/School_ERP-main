const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const assignments = [
    { class: '12', section: 'A', isClassTeacher: true },
    { class: '12', section: 'ALL', isClassTeacher: true }
  ];
  
  const result = await prisma.faculty.updateMany({
    data: { assignments }
  });
  
  console.log(`Updated ${result.count} faculty records to Class 12`);
}
run().catch(console.error).finally(() => prisma.$disconnect());
