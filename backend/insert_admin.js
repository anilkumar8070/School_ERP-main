const prisma = require('./prisma/client');
const bcrypt = require('bcryptjs');

async function main() {
  const email = 'admin1@gmail.com';
  const plainPassword = '123456789';
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  const admin = await prisma.user.upsert({
    where: { username: email },
    update: {
      password: hashedPassword,
      role: 'admin',
      name: 'Admin User'
    },
    create: {
      username: email,
      password: hashedPassword,
      role: 'admin',
      name: 'Admin User',
      parentOf: []
    }
  });

  console.log('Admin user successfully created/updated in the database!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
