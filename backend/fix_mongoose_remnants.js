const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

for (const file of files) {
  const filePath = path.join(routesDir, file);
  let code = fs.readFileSync(filePath, 'utf8');
  const original = code;

  // Replace deleteOne, deleteMany, findOneAndDelete
  code = code.replace(/\.(deleteOne|deleteMany|findOneAndDelete)\s*\(\s*\{([\s\S]*?)\}\s*\)/g, (match, method, inner) => {
    // Also replace _id with id inside the condition
    const fixedInner = inner.replace(/_id\s*:/g, "id:");
    return `.deleteMany({ where: {${fixedInner}} })`;
  });

  // Replace find(obj).sort({ createdAt: -1 })
  code = code.replace(/\.find\(\s*(\{[\s\S]*?\})\s*\)\.sort\(\s*\{[\s\S]*?createdAt:\s*-1[\s\S]*?\}\s*\)/g, (match, inner) => {
    return `.findMany({ where: ${inner}, orderBy: { createdAt: 'desc' } })`;
  });

  // Replace find(var).sort({ createdAt: -1 })
  code = code.replace(/\.find\(\s*([a-zA-Z0-9_]+)\s*\)\.sort\(\s*\{[\s\S]*?createdAt:\s*-1[\s\S]*?\}\s*\)/g, (match, inner) => {
    return `.findMany({ where: ${inner}, orderBy: { createdAt: 'desc' } })`;
  });

  if (code !== original) {
    fs.writeFileSync(filePath, code);
    console.log('Fixed', file);
  }
}
console.log('Done.');
