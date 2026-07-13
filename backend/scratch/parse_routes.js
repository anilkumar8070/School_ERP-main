const fs = require('fs');
const lines = fs.readFileSync('index.js', 'utf8').split('\n');
const routes = [];
let insideRoute = false;
let currentRoute = '';
let currentLine = 0;

lines.forEach((line, i) => {
    const match = line.match(/app\.(get|post|put|delete|patch|use)\s*\(\s*['"]([^'"]+)['"]/);
    if(match) {
        routes.push(`${i+1}: ${match[1].toUpperCase()} ${match[2]}`);
    }
});

fs.writeFileSync('scratch/routes.txt', routes.join('\n'));
console.log('Found ' + routes.length + ' routes');
