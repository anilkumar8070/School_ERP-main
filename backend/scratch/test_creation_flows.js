require('dotenv').config();
const prisma = require('../prisma/client');
const { Student, User, Faculty, FacultyRegistration } = require('../mongoose_to_prisma');
const { sendCredentialEmail } = require('../utils/mailer');
const bcrypt = require('bcryptjs');

async function testAllCreationFlows() {
  console.log('=== STARTING PROFILE CREATION & CREDENTIAL EMAIL AUDIT ===\n');

  const testEmail = 'iitiancraft3@gmail.com';
  const testName = 'Anil Kumar';
  const testClass = '10';


  // 1. Clean up any pre-existing test data for nnm23cs110@gmail.com
  try {
    await prisma.student.deleteMany({ where: { email: testEmail } }).catch(() => {});
    await prisma.user.deleteMany({ where: { username: testEmail } }).catch(() => {});
    console.log(`[Cleanup] Cleaned existing student & user records for ${testEmail}`);
  } catch (e) {
    console.warn('[Cleanup] Warning during cleanup:', e.message);
  }

  // 2. Test Student Creation Flow (mirroring POST /api/students)
  console.log('\n--- 1. Testing Student Creation & Email Flow ---');
  const sections = ['A', 'B', 'C', 'D'];
  let assignedSection = 'A';
  const existingCount = await prisma.student.count({ where: { class: testClass, section: assignedSection } }).catch(() => 0);
  const rollNo = `${testClass}${assignedSection}${existingCount + 1}`;

  const studentDoc = await Student.create({
    name: testName,
    email: testEmail,
    class: testClass,
    section: assignedSection,
    rollNo,
    gender: 'Male',
    medium: 'English'
  });
  console.log('✅ Student record created in DB:', { id: studentDoc.id, email: studentDoc.email, rollNo });

  const generatedPassword = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 90 + 10);
  const hashed = await bcrypt.hash(generatedPassword, 10);

  const userDoc = await User.create({
    username: testEmail,
    password: hashed,
    role: 'student',
    name: testName
  });
  console.log('✅ User account created in DB:', { id: userDoc.id, username: userDoc.username, role: userDoc.role });

  console.log(`\nDispatching credential email to ${testEmail}...`);
  const studentMailResult = await sendCredentialEmail({
    to: testEmail,
    name: testName,
    role: 'Student',
    username: testEmail,
    password: generatedPassword,
    extraDetails: {
      'Class': testClass,
      'Section': assignedSection,
      'Roll No': rollNo
    }
  });

  console.log('Student Mail Result:', JSON.stringify(studentMailResult, null, 2));

  // 3. Test Teacher (Faculty) Creation Email Flow
  console.log('\n--- 2. Testing Teacher (Faculty) Credential Email Flow ---');
  const facultyMailResult = await sendCredentialEmail({
    to: testEmail,
    name: testName,
    role: 'Teacher',
    username: testEmail,
    password: 'DemoFacultyPassword123',
    extraDetails: {
      'Employee ID': 'EMP009123',
      'Subject': 'Computer Science',
      'Class Grade': '10'
    }
  });
  console.log('Faculty Mail Result:', JSON.stringify(facultyMailResult, null, 2));

  // 4. Test Staff Creation Email Flow
  console.log('\n--- 3. Testing Staff Credential Email Flow ---');
  const staffMailResult = await sendCredentialEmail({
    to: testEmail,
    name: testName,
    role: 'Staff',
    username: testEmail,
    password: 'DemoStaffPassword123',
    extraDetails: {
      'Designation': 'System Administrator',
      'Contact': '+91 9876543210'
    }
  });
  console.log('Staff Mail Result:', JSON.stringify(staffMailResult, null, 2));

  // 5. Test Parent Creation Email Flow
  console.log('\n--- 4. Testing Parent Credential Email Flow ---');
  const parentMailResult = await sendCredentialEmail({
    to: testEmail,
    name: testName,
    role: 'Parent',
    username: testEmail,
    password: 'DemoParentPassword123',
    extraDetails: {
      'Contact': '+91 9876543210'
    }
  });
  console.log('Parent Mail Result:', JSON.stringify(parentMailResult, null, 2));

  // 6. Verify Database Record
  const verifyStudent = await prisma.student.findFirst({ where: { email: testEmail } });
  const verifyUser = await prisma.user.findFirst({ where: { username: testEmail } });
  console.log('\n=== FINAL DATABASE VERIFICATION ===');
  console.log('Verified Student in DB:', verifyStudent ? `Found ID: ${verifyStudent.id}` : 'NOT FOUND');
  console.log('Verified User in DB:', verifyUser ? `Found ID: ${verifyUser.id}` : 'NOT FOUND');

  console.log('\n=== AUDIT COMPLETE ===');
  process.exit(0);
}

testAllCreationFlows().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
