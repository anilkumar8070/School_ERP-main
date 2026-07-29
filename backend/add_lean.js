const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/ayush/OneDrive/Desktop/School_ERP-main/backend/routes';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

files.forEach(f => {
  const filePath = path.join(dir, f);
  let code = fs.readFileSync(filePath, 'utf8');
  let original = code;

  // Regex matches `.sort({ ... })` and checks if it's followed by `.lean()`
  code = code.replace(/(\.sort\s*\([^)]+\))(?!\s*\.lean\(\))/g, '$1.lean()');

  if (code !== original) {
    fs.writeFileSync(filePath, code);
    console.log(`Updated ${f}`);
  }
});
console.log('Finished');
