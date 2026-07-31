const { Client } = require('pg');

const passwords = ['postgres', 'root', 'admin', '123456', 'password', ''];

async function findPostgresCredentials() {
  for (const pwd of passwords) {
    const connectionString = `postgresql://postgres:${pwd}@127.0.0.1:5432/postgres`;
    const client = new Client({ connectionString });
    try {
      await client.connect();
      console.log(`FOUND WORKING POSTGRES PASSWORD: "${pwd}"`);
      
      // Check if school_erp database exists, if not create it
      const res = await client.query("SELECT 1 FROM pg_database WHERE datname='school_erp'");
      if (res.rowCount === 0) {
        await client.query("CREATE DATABASE school_erp");
        console.log("Created database 'school_erp'");
      } else {
        console.log("Database 'school_erp' already exists.");
      }
      await client.end();
      return pwd;
    } catch (err) {
      // console.log(`Failed with password "${pwd}": ${err.message}`);
    }
  }
  console.log("Could not connect with common passwords.");
}

findPostgresCredentials();
