const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

for (const file of files) {
  const filePath = path.join(routesDir, file);
  let code = fs.readFileSync(filePath, 'utf8');
  const original = code;

  // Replace MongoDB 11000 with Prisma P2002
  code = code.replace(/===\s*11000/g, "=== 'P2002'");
  code = code.replace(/===\s*'11000'/g, "=== 'P2002'");

  if (code !== original) {
    fs.writeFileSync(filePath, code);
    console.log('Fixed', file);
  }
}
console.log('Done.');
