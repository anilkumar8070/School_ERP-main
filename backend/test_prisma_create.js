const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    // try to create a notice without 'data:' wrapper
    await prisma.notice.create({
      title: 'Test',
      content: 'Test content',
      audience: 'all'
    });
    console.log("SUCCESS!");
  } catch(e) {
    console.error("ERROR:", e.message);
  }
  prisma.$disconnect();
}
main();
