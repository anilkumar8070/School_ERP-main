const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const hashed = await bcrypt.hash('12345', 10);
  const result = await prisma.user.updateMany({
    where: { username: 'Ni@gmail.com' },
    data: { password: hashed }
  });
  console.log('Updated', result.count, 'users to password 12345');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
