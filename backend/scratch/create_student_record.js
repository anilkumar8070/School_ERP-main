require('dotenv').config();
const prisma = require('../prisma/client');
const { Student, User } = require('../mongoose_to_prisma');
const { sendCredentialEmail } = require('../utils/mailer');
const bcrypt = require('bcryptjs');

async function createStudent() {
  const targetEmail = 'nnm23cs110@gmail.com';
  const targetName = 'Anil Kumar';
  const targetClass = '10';

  console.log(`=== CREATING STUDENT RECORD FOR ${targetEmail} ===`);

  // Clean up existing record if any to ensure fresh creation
  await prisma.student.deleteMany({ where: { email: targetEmail } }).catch(() => {});
  await prisma.user.deleteMany({ where: { username: targetEmail } }).catch(() => {});

  const sections = ['A', 'B', 'C', 'D'];
  let assignedSection = 'A';
  const count = await prisma.student.count({ where: { class: targetClass, section: assignedSection } }).catch(() => 0);
  const rollNo = `${targetClass}${assignedSection}${count + 1}`;

  // 1. Create Student record
  const studentDoc = await Student.create({
    name: targetName,
    email: targetEmail,
    class: targetClass,
    section: assignedSection,
    rollNo: rollNo,
    gender: 'Male',
    medium: 'English'
  });
  console.log('✅ Student Record Created in Database:');
  console.log('   ID:', studentDoc.id);
  console.log('   Name:', studentDoc.name);
  console.log('   Email:', studentDoc.email);
  console.log('   Class:', studentDoc.class);
  console.log('   Section:', studentDoc.section);
  console.log('   Roll No:', studentDoc.rollNo);

  // 2. Create User account
  const generatedPassword = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 90 + 10);
  const hashed = await bcrypt.hash(generatedPassword, 10);
  const userDoc = await User.create({
    username: targetEmail,
    password: hashed,
    role: 'student',
    name: targetName
  });
  console.log('✅ User Login Account Created in Database:');
  console.log('   ID:', userDoc.id);
  console.log('   Username:', userDoc.username);
  console.log('   Role:', userDoc.role);
  console.log('   Generated Password:', generatedPassword);

  // 3. Trigger Credential Email
  console.log(`\nTriggering credential email to ${targetEmail}...`);
  const mailStatus = await sendCredentialEmail({
    to: targetEmail,
    name: targetName,
    role: 'Student',
    username: targetEmail,
    password: generatedPassword,
    extraDetails: {
      'Class': targetClass,
      'Section': assignedSection,
      'Roll No': rollNo
    }
  });

  console.log('Email Status:', mailStatus);
  process.exit(0);
}

createStudent().catch(err => {
  console.error('Error creating student record:', err);
  process.exit(1);
});
