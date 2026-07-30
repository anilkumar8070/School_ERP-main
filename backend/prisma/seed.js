require('dotenv').config();
const prisma = require('./client');
const bcrypt = require('bcryptjs');

async function main() {
  console.log('Seeding Prisma PostgreSQL database...');

  const hashedPasswordAdmin = await bcrypt.hash('admin123', 10);
  const hashedPasswordTeacher = await bcrypt.hash('teacher123', 10);
  const hashedPasswordStudent = await bcrypt.hash('student123', 10);
  const hashedPasswordParent = await bcrypt.hash('parent123', 10);
  const hashedPasswordOffice = await bcrypt.hash('office123', 10);

  // Users to create
  const usersToSeed = [
    { username: 'admin', password: hashedPasswordAdmin, role: 'admin', name: 'Site Administrator' },
    { username: 'admin1', password: hashedPasswordAdmin, role: 'admin', name: 'System Admin' },
    { username: 'teacher1', password: hashedPasswordTeacher, role: 'faculty', name: 'Jane Doe' },
    { username: 'faculty', password: hashedPasswordTeacher, role: 'faculty', name: 'John Smith' },
    { username: 'student1', password: hashedPasswordStudent, role: 'student', name: 'Alex Johnson' },
    { username: 'student', password: hashedPasswordStudent, role: 'student', name: 'Emily Davis' },
    { username: 'parent1', password: hashedPasswordParent, role: 'parent', name: 'Robert Johnson' },
    { username: 'parent', password: hashedPasswordParent, role: 'parent', name: 'Sarah Davis' },
    { username: 'office1', password: hashedPasswordOffice, role: 'office-management', name: 'Office Manager' }
  ];

  for (const user of usersToSeed) {
    await prisma.user.upsert({
      where: { username: user.username },
      update: { password: user.password, role: user.role, name: user.name },
      create: user
    });
  }
  console.log('✅ Users seeded');

  // Seed Classes
  const class10 = await prisma.class.upsert({
    where: { name: 'Class 10' },
    update: { subjects: ['Mathematics', 'Science', 'English', 'Social Studies'] },
    create: { name: 'Class 10', subjects: ['Mathematics', 'Science', 'English', 'Social Studies'] }
  });

  const class9 = await prisma.class.upsert({
    where: { name: 'Class 9' },
    update: { subjects: ['Mathematics', 'Science', 'English'] },
    create: { name: 'Class 9', subjects: ['Mathematics', 'Science', 'English'] }
  });
  console.log('✅ Classes seeded');

  // Seed Students
  await prisma.student.upsert({
    where: { email: 'alex.johnson@school.com' },
    update: { name: 'Alex Johnson', class: 'Class 10', section: 'A', rollNo: '1001', gender: 'Male', medium: 'English' },
    create: { name: 'Alex Johnson', email: 'alex.johnson@school.com', class: 'Class 10', section: 'A', rollNo: '1001', gender: 'Male', medium: 'English' }
  });

  await prisma.student.upsert({
    where: { email: 'emily.davis@school.com' },
    update: { name: 'Emily Davis', class: 'Class 9', section: 'B', rollNo: '9001', gender: 'Female', medium: 'English' },
    create: { name: 'Emily Davis', email: 'emily.davis@school.com', class: 'Class 9', section: 'B', rollNo: '9001', gender: 'Female', medium: 'English' }
  });
  console.log('✅ Students seeded');

  // Seed Faculty
  await prisma.faculty.upsert({
    where: { email: 'jane.doe@school.com' },
    update: { name: 'Jane Doe', subject: 'Mathematics', classGrade: 'Class 10', contact: '9876543210', experience: '5 years' },
    create: { name: 'Jane Doe', email: 'jane.doe@school.com', subject: 'Mathematics', classGrade: 'Class 10', contact: '9876543210', experience: '5 years' }
  });
  console.log('✅ Faculty seeded');

  // Seed Notices
  const existingNotice = await prisma.notice.findFirst({ where: { title: 'Welcome to New Academic Year' } });
  if (!existingNotice) {
    await prisma.notice.create({
      data: {
        title: 'Welcome to New Academic Year',
        body: 'Classes commence next Monday. Please review the updated timetable.',
        createdByName: 'Site Administrator',
        createdAt: new Date()
      }
    });
  }
  console.log('✅ Notices seeded');

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
