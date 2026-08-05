const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const facs = await prisma.faculty.findMany();
  console.log(JSON.stringify(facs, null, 2));
}

main().finally(() => prisma.$disconnect());
