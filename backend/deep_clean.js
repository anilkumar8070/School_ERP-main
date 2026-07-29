const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

// 1. Remove Student and User from admit card registration
code = code.replace(/Student,\s*User,/g, '');

// 2. Remove mongoose connection listeners and connectDb
const startText = "// Register Mongoose connection event listeners";
const endText = "// attempt database connection (non-blocking)";
const startIdx = code.indexOf(startText);
const endIdx = code.indexOf(endText);

if (startIdx !== -1 && endIdx !== -1) {
  code = code.substring(0, startIdx) + 
         "async function connectDb() { dbConnected = true; }\n" + 
         code.substring(endIdx);
}

// 3. Just to be safe, rip out any stray mongoose.connection references
code = code.replace(/mongoose\.connection[a-zA-Z0-9_.()=\s{}]*;/g, '');
code = code.replace(/if\s*\(mongoose\.connection\.readyState[\s\S]*?\}\s*\)/g, 'if(false){}');

fs.writeFileSync('index.js', code);
console.log('index.js deeply cleaned!');
