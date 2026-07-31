const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
    const f = await prisma.faculty.create({
      data: {
        name: 'Ni',
        email: 'Ni@gmail.com',
        employeeId: 'EMP123456',
        subject: 'Math',
        experience: '5',
        contact: '1234567890',
        classGrade: '1',
        houses: []
      }
    });
    console.log('Created:', f);
  } catch (e) {
    console.error('Error:', e);
  }
}
run().finally(() => prisma.$disconnect());
