const fs = require('fs');
const path = require('path');

const filesToFix = [
  { file: 'complaintsRoutes.js', varName: 'c' },
  { file: 'leavesRoutes.js', varName: 'leave' },
  { file: 'messagesRoutes.js', varName: 'm' }
];

filesToFix.forEach(({ file, varName }) => {
  const filePath = path.join(__dirname, 'routes', file);
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/const saved = \/\/ Transpiled save\(\)/g, `const saved = ${varName}; // Transpiled save()`);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed syntax in ${file}`);
});
