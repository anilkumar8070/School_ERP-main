const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

for (const file of files) {
  const filePath = path.join(routesDir, file);
  let code = fs.readFileSync(filePath, 'utf8');
  const original = code;

  // Replace simple Mongoose operators
  code = code.replace(/\$or/g, 'OR');
  code = code.replace(/\$and/g, 'AND');
  code = code.replace(/\$gte/g, 'gte');
  code = code.replace(/\$lte/g, 'lte');
  code = code.replace(/\$gt/g, 'gt');
  code = code.replace(/\$lt/g, 'lt');

  // Replace specific RegExp patterns
  // Pattern 1: adminsRoutes, hrRoutes, parentsRoutes, staffRoutes
  code = code.replace(/name:\s*re/g, "name: { contains: q, mode: 'insensitive' }");
  code = code.replace(/username:\s*re/g, "username: { contains: q, mode: 'insensitive' }");
  code = code.replace(/email:\s*re/g, "email: { contains: q, mode: 'insensitive' }");
  code = code.replace(/contact:\s*re/g, "contact: { contains: q, mode: 'insensitive' }");
  code = code.replace(/employeeId:\s*re/g, "employeeId: { contains: q, mode: 'insensitive' }");

  // Pattern 2: facultyRoutes
  code = code.replace(/q\.subject\s*=\s*new RegExp\(String\(subject\),\s*'i'\);/g, "q.subject = { contains: String(subject), mode: 'insensitive' };");

  if (code !== original) {
    fs.writeFileSync(filePath, code);
    console.log('Fixed', file);
  }
}
console.log('Done.');
