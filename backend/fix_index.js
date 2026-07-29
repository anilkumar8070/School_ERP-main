const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');
code = code.split('\n').filter(line => !line.includes("require('./models/") && !line.includes("require('../models/")).join('\n');
fs.writeFileSync('index.js', code);
