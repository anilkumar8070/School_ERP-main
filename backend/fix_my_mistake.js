const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

for (const file of files) {
  const filePath = path.join(routesDir, file);
  let code = fs.readFileSync(filePath, 'utf8');
  const original = code;

  code = code.replace(/\{ contains: q, mode: 'insensitive' \}q\./g, "req.");

  if (code !== original) {
    fs.writeFileSync(filePath, code);
    console.log('Fixed', file);
  }
}
console.log('Done.');
