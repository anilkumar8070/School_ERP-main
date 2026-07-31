const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create default admin
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD || 'admin';
  const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
  
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedAdminPassword,
      role: 'admin',
      name: 'Site Administrator'
    }
  });
  console.log(`✅ Default Admin user ensured: ${admin.username}`);

  // Create default faculty
  const facultyPassword = process.env.DEMO_FACULTY_PASSWORD || 'faculty';
  const hashedFacultyPassword = await bcrypt.hash(facultyPassword, 10);
  
  const faculty = await prisma.user.upsert({
    where: { username: 'faculty' },
    update: {},
    create: {
      username: 'faculty',
      password: hashedFacultyPassword,
      role: 'faculty',
      name: 'Faculty Member'
    }
  });
  console.log(`✅ Default Faculty user ensured: ${faculty.username}`);

  // Create default student
  const studentPassword = process.env.DEMO_STUDENT_PASSWORD || 'student';
  const hashedStudentPassword = await bcrypt.hash(studentPassword, 10);
  
  const student = await prisma.user.upsert({
    where: { username: 'student' },
    update: {},
    create: {
      username: 'student',
      password: hashedStudentPassword,
      role: 'student',
      name: 'Student User'
    }
  });
  console.log(`✅ Default Student user ensured: ${student.username}`);
  
  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
