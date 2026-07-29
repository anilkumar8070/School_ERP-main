const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'routes');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

files.forEach(f => {
  const filePath = path.join(dir, f);
  let code = fs.readFileSync(filePath, 'utf8');
  const original = code;

  // Replace await Model.find({ query }).lean()
  // Note: we can't perfectly regex nested brackets, but we can do a best effort.
  // A safer approach is to use standard string replacement for common patterns.
  
  // 1. replace `.find(` with `.findMany({ where: ` 
  // Wait, if it's `.find()` it becomes `.findMany()` without where.
  code = code.replace(/\.find\(\{\}\)/g, '.findMany()');
  code = code.replace(/\.find\((.*?)\)/g, (match, p1) => {
    if (!p1.trim() || p1.trim() === '{}') return '.findMany()';
    return `.findMany({ where: ${p1} })`;
  });

  // 2. replace `.findOne(` with `.findFirst({ where: `
  code = code.replace(/\.findOne\((.*?)\)/g, (match, p1) => {
    if (!p1.trim() || p1.trim() === '{}') return '.findFirst()';
    return `.findFirst({ where: ${p1} })`;
  });

  // 3. replace `.findById(id)` with `.findUnique({ where: { id } })`
  code = code.replace(/\.findById\((.*?)\)/g, (match, p1) => {
    return `.findUnique({ where: { id: ${p1} } })`;
  });

  // 4. replace `.create(data)` with `.create({ data: ... })`
  code = code.replace(/\.create\((.*?)\)/g, (match, p1) => {
    // sometimes create takes an array. Prisma createMany takes data: [...]
    return `.create({ data: ${p1} })`;
  });

  // 5. replace `.findByIdAndUpdate(id, data, ...)`
  // This is hard to regex because of multiple arguments.
  
  // 6. remove .lean()
  code = code.replace(/\.lean\(\)/g, '');

  if (code !== original) {
    fs.writeFileSync(filePath, code);
    console.log(`Transpiled ${f}`);
  }
});
console.log('Transpilation pass 1 complete.');
