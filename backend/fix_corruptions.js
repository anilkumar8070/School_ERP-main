const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

for (const file of files) {
  const filePath = path.join(routesDir, file);
  let code = fs.readFileSync(filePath, 'utf8');
  const original = code;

  // Replace back \{ contains: q, mode: 'insensitive' \}([a-zA-Z]+) to re$1
  code = code.replace(/\{\s*contains:\s*q,\s*mode:\s*'insensitive'\s*\}([a-zA-Z]+)/g, "re$1");

  if (code !== original) {
    fs.writeFileSync(filePath, code);
    console.log('Fixed', file);
  }
}
console.log('Done.');
