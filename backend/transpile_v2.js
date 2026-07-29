const fs = require('fs');
const path = require('path');

function transpileFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  const original = code;

  // Replace mongoose require
  code = code.replace(/const\s+\{\s*([A-Za-z0-9_,\s]+)\s*\}\s*=\s*require\(['"]\.\.\/models\/[^'"]+['"]\);/g, '');
  code = code.replace(/const\s+([A-Za-z0-9_]+)\s*=\s*require\(['"]\.\.\/models\/[^'"]+['"]\);/g, '');
  
  // add prisma require at top if not there
  if (!code.includes("require('../prisma/client')") && !code.includes('require("./prisma/client")')) {
    let clientPath = filePath.includes('routes') ? '../prisma/client' : './prisma/client';
    code = `const prisma = require('${clientPath}');\n` + code;
  }

  // Mongoose -> Prisma transpilation rules targeting uppercase models
  code = code.replace(/\b([A-Z][a-zA-Z0-9_]*)\.find\(\s*\{\}\s*\)/g, 'prisma.$1.findMany()');
  code = code.replace(/\b([A-Z][a-zA-Z0-9_]*)\.find\((.*?)\)/g, (match, model, args) => {
    if (!args.trim() || args.trim() === '{}') return `prisma.${model.toLowerCase()}.findMany()`;
    return `prisma.${model.toLowerCase()}.findMany({ where: ${args} })`;
  });

  code = code.replace(/\b([A-Z][a-zA-Z0-9_]*)\.findOne\((.*?)\)/g, (match, model, args) => {
    if (!args.trim() || args.trim() === '{}') return `prisma.${model.toLowerCase()}.findFirst()`;
    return `prisma.${model.toLowerCase()}.findFirst({ where: ${args} })`;
  });

  code = code.replace(/\b([A-Z][a-zA-Z0-9_]*)\.findById\((.*?)\)/g, (match, model, args) => {
    return `prisma.${model.toLowerCase()}.findUnique({ where: { id: String(${args}) } })`;
  });

  code = code.replace(/\b([A-Z][a-zA-Z0-9_]*)\.create\((.*?)\)/g, (match, model, args) => {
    return `prisma.${model.toLowerCase()}.create({ data: ${args} })`;
  });

  code = code.replace(/\b([A-Z][a-zA-Z0-9_]*)\.countDocuments\((.*?)\)/g, (match, model, args) => {
    if (!args.trim() || args.trim() === '{}') return `prisma.${model.toLowerCase()}.count()`;
    return `prisma.${model.toLowerCase()}.count({ where: ${args} })`;
  });

  code = code.replace(/\b([A-Z][a-zA-Z0-9_]*)\.insertMany\((.*?)\)/g, (match, model, args) => {
    return `prisma.${model.toLowerCase()}.createMany({ data: ${args} })`;
  });

  code = code.replace(/\b([A-Z][a-zA-Z0-9_]*)\.findByIdAndDelete\((.*?)\)/g, (match, model, id) => {
    return `prisma.${model.toLowerCase()}.delete({ where: { id: String(${id}) } })`;
  });

  code = code.replace(/\b([A-Z][a-zA-Z0-9_]*)\.deleteMany\((.*?)\)/g, (match, model, args) => {
    if (!args.trim() || args.trim() === '{}') return `prisma.${model.toLowerCase()}.deleteMany()`;
    return `prisma.${model.toLowerCase()}.deleteMany({ where: ${args} })`;
  });
  
  // Replace .lean()
  code = code.replace(/\.lean\(\)/g, '');

  if (code !== original) {
    fs.writeFileSync(filePath, code);
    console.log(`Transpiled ${path.basename(filePath)}`);
  }
}

const dir = path.join(__dirname, 'routes');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
files.forEach(f => transpileFile(path.join(dir, f)));

// Also transpile index.js
transpileFile(path.join(__dirname, 'index.js'));
