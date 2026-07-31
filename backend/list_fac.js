const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const facs = await prisma.faculty.findMany();
  console.log(JSON.stringify(facs, null, 2));
}
run().catch(console.error).finally(() => prisma.$disconnect());
