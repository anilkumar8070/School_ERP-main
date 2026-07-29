const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesDir);

files.forEach(file => {
  if (file.endsWith('.js')) {
    const filePath = path.join(routesDir, file);
    let code = fs.readFileSync(filePath, 'utf8');
    
    // Replace !dbConnected with false
    code = code.replace(/!dbConnected/g, 'false');
    // Replace dbConnected with true (but only standalone word, avoiding matching something like 'mdbConnected')
    code = code.replace(/\bdbConnected\b/g, 'true');
    
    fs.writeFileSync(filePath, code);
  }
});
console.log('Cleaned dbConnected from all route files!');
