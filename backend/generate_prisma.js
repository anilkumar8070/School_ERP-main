const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, 'models');
const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.js'));

let prismaSchema = `
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
`;

function mapType(instance, options) {
  if (instance === 'String') return 'String';
  if (instance === 'Number') return 'Float';
  if (instance === 'Boolean') return 'Boolean';
  if (instance === 'Date') return 'DateTime';
  if (instance === 'ObjectID' || instance === 'ObjectId') return 'String';
  if (instance === 'Array') return 'Json'; // Default arrays to JSON for now
  if (instance === 'Mixed') return 'Json';
  return 'String'; // Fallback
}

files.forEach(file => {
  try {
    const model = require(path.join(modelsDir, file));
    const modelName = model.modelName || file.replace('.js', '');
    
    // Some exports might not be models, check if it has schema
    if (!model.schema) return;
    
    prismaSchema += `\nmodel ${modelName} {\n`;
    prismaSchema += `  id String @id @default(uuid())\n`; // Postgres uses UUIDs for MongoDB ObjectIds
    
    for (const [pathName, schemaType] of Object.entries(model.schema.paths)) {
      if (pathName === '_id' || pathName === '__v') continue;
      
      const isArray = schemaType.instance === 'Array';
      let type = mapType(schemaType.instance, schemaType.options);
      
      // Handle nested arrays like [{ term: String, amount: Number }] as JSON in Postgres to avoid too many tables
      if (isArray) {
        type = 'Json';
      }
      
      let modifier = schemaType.options.required ? '' : '?';
      if (type === 'Json') modifier = ''; // JSON usually doesn't need ? if we default to []
      
      // Sanitize pathName for Prisma (no spaces or weird characters)
      const cleanPathName = pathName.replace(/[^a-zA-Z0-9_]/g, '_');
      
      if (cleanPathName.includes('_')) {
         // It's a nested path like 'address.city' -> skip or map to JSON
         continue; 
      }
      
      let unique = schemaType.options.unique ? ' @unique' : '';
      
      prismaSchema += `  ${cleanPathName} ${type}${modifier}${unique}\n`;
    }
    
    if (model.schema.options.timestamps) {
      if (!model.schema.paths.createdAt) prismaSchema += `  createdAt DateTime @default(now())\n`;
      if (!model.schema.paths.updatedAt) prismaSchema += `  updatedAt DateTime @updatedAt\n`;
    }
    
    prismaSchema += `}\n`;
  } catch (e) {
    console.error(`Error processing ${file}: ${e.message}`);
  }
});

const prismaDir = path.join(__dirname, 'prisma');
if (!fs.existsSync(prismaDir)) {
  fs.mkdirSync(prismaDir);
}
fs.writeFileSync(path.join(prismaDir, 'schema.prisma'), prismaSchema);
console.log('Prisma schema generated successfully.');
