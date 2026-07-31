const { PrismaClient } = require('@prisma/client');

const usernames = ['postgres', 'Mithesh', 'root', 'admin'];
const passwords = ['postgres', 'root', 'admin', '123456', 'password', '1234', '12345678', 'Mithesh', 'mithesh', 'Pass@123', 'Postgres', 'Postgresql', ''];

async function testCombinations() {
  for (const user of usernames) {
    for (const pwd of passwords) {
      const dbUrl = `postgresql://${user}:${pwd}@localhost:5432/school_erp?schema=public`;
      const prisma = new PrismaClient({
        datasources: { db: { url: dbUrl } }
      });
      try {
        await prisma.$connect();
        console.log(`\n\n=============================================`);
        console.log(`SUCCESS! User: "${user}", Password: "${pwd}"`);
        console.log(`Connection URL: ${dbUrl}`);
        console.log(`=============================================\n\n`);
        await prisma.$disconnect();
        return { user, pwd, dbUrl };
      } catch (e) {
        if (!e.message.includes('Authentication failed')) {
          console.log(`User "${user}" Pwd "${pwd}": ${e.message.split('\n')[0]}`);
          // If error is database "school_erp" does not exist, connection is actually successful!
          if (e.message.includes('database "school_erp" does not exist') || e.message.includes('db error: ERROR: database "school_erp" does not exist')) {
            console.log(`\n\n=============================================`);
            console.log(`SUCCESSFUL AUTH! User: "${user}", Password: "${pwd}" (DB needs creation)`);
            console.log(`=============================================\n\n`);
            await prisma.$disconnect().catch(() => {});
            return { user, pwd, dbUrl };
          }
        }
        await prisma.$disconnect().catch(() => {});
      }
    }
  }
  console.log("Finished searching combinations.");
}

testCombinations();
