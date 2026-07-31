const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'routes');
fs.readdirSync(dir).forEach(f => {
  if (!f.endsWith('.js')) return;
  let p = path.join(dir, f);
  let c = fs.readFileSync(p, 'utf8');
  let newC = c;
  
  // Find all prisma requires
  const matches = [...c.matchAll(/const\s+prisma\s*=\s*require\(['"].*?['"]\);/g)];
  if (matches.length > 1) {
    // Remove all but the first one
    for (let i = 1; i < matches.length; i++) {
      newC = newC.replace(matches[i][0], '');
    }
  }
  
  if (c !== newC) {
    fs.writeFileSync(p, newC);
    console.log('Fixed', f);
  }
});
