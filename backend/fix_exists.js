const fs = require('fs');
const path = require('path');
const glob = require('fs').readdirSync(path.join(__dirname, 'routes')).filter(f => f.endsWith('.js'));

glob.forEach(file => {
  const p = path.join(__dirname, 'routes', file);
  let code = fs.readFileSync(p, 'utf8');
  let original = code;
  
  // Replace { $exists: false } with null
  code = code.replace(/\{\s*\$exists\s*:\s*false\s*\}/g, 'null');
  
  // Replace { $exists: true, $ne: null } or similar
  // Wait, let's just replace $exists: true with { not: null } if it's the only key.
  code = code.replace(/\{\s*\$exists\s*:\s*true\s*\}/g, '{ not: null }');
  code = code.replace(/\{\s*\$exists\s*:\s*true\s*,\s*\$ne\s*:\s*null\s*\}/g, '{ not: null }');
  code = code.replace(/\{\s*\$ne\s*:\s*null\s*,\s*\$exists\s*:\s*true\s*\}/g, '{ not: null }');

  if (code !== original) {
    fs.writeFileSync(p, code);
    console.log('Fixed $exists in', file);
  }
});
