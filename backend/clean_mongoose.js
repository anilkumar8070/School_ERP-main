const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

// Remove require
code = code.replace(/const mongoose = require\('mongoose'\);?/g, '');

// Replace connect block entirely
code = code.replace(/mongoose\.connection\.on\([^)]+\)\s*\{[\s\S]*?\}/g, '');

code = code.replace(/await mongoose\.connect\([^)]+\);?/g, '');

// Graceful shutdown replacements
code = code.replace(/if\s*\(mongoose\.connection\.readyState[^)]+\)\s*\{/g, 'if (false) {');
code = code.replace(/mongoose\.connection\.close\(\)\.then/g, 'Promise.resolve().then');

fs.writeFileSync('index.js', code);
console.log('Mongoose references cleaned from index.js');
