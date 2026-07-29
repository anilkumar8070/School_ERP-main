const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesDir);

files.forEach(file => {
  if (file.endsWith('.js')) {
    const filePath = path.join(routesDir, file);
    let code = fs.readFileSync(filePath, 'utf8');
    
    // Remove require('mongoose')
    code = code.replace(/const mongoose = require\(['"]mongoose['"]\);?\n?/g, '');
    
    // Replace readyState checks
    code = code.replace(/mongoose\.connection\.readyState\s*===\s*1/g, 'true');
    code = code.replace(/mongoose\.connection\.readyState/g, '1'); // For any other logic
    
    // Replace ObjectIds if any
    code = code.replace(/mongoose\.Types\.ObjectId\([^)]*\)/g, '($1)');
    code = code.replace(/mongoose\.Types\.ObjectId\.isValid\([^)]*\)/g, 'true');

    fs.writeFileSync(filePath, code);
  }
});
console.log('Cleaned mongoose from all route files!');
