const fs = require('fs');
const path = require('path');
const routesDir = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
for (const file of files) {
  try {
    require(path.join(routesDir, file));
    console.log('Successfully required', file);
  } catch(e) {
    console.error('Error requiring', file, e.message);
    process.exit(1);
  }
}
console.log('All routes load successfully!');
