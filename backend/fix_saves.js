const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // We want to replace `/* FIXME: Mongoose .save() */ await <var>.save();`
  // We need to find what `<var>` is, and what model it belongs to.
  
  // A naive approach: search for `await prisma.([a-zA-Z0-9_]+)\.find` before the save call
  
  let match;
  const saveRegex = /\/\*\s*FIXME:\s*Mongoose\s*\.save\(\)\s*\*\/\s*await\s+([a-zA-Z0-9_]+)\.save\(\);?/g;
  
  let newContent = content.replace(saveRegex, (match, varName, offset) => {
    // Look backwards from this offset to find the nearest `prisma.<model>.find`
    const beforeStr = content.slice(0, offset);
    // Regex to find `await prisma.<model>.find` assigning to the exact varName, or just the nearest one
    const modelMatch = beforeStr.match(new RegExp(`(?:const|let|var)\\s+(?:\\{\\s*\\w+\\s*\\}|${varName})\\s*=\\s*(?:await\\s+)?prisma\\.([a-zA-Z0-9_]+)\\.(?:findUnique|findFirst|update|create)`, 'g'));
    
    if (modelMatch && modelMatch.length > 0) {
      const lastMatch = modelMatch[modelMatch.length - 1];
      const m = lastMatch.match(/prisma\.([a-zA-Z0-9_]+)\./);
      if (m && m[1]) {
        const modelName = m[1];
        // We will just do a blind update:
        // await prisma.<model>.update({ where: { id: String(<var>.id) }, data: <var> })
        // Note: passing the whole object to `data` might fail if it contains unsupported fields like relations,
        // but it's the closest equivalent to .save() for scalar updates.
        // Actually, Prisma might reject `id` inside data, so we can destructure it.
        return `
    // Transpiled save()
    if (${varName} && ${varName}.id) {
      const { id: _id_unused, ..._updateData } = ${varName};
      await prisma.${modelName}.update({
        where: { id: String(${varName}.id) },
        data: _updateData
      });
    } else if (${varName} && ${varName}._id) {
      const { _id: _id_unused2, ..._updateData2 } = ${varName};
      await prisma.${modelName}.update({
        where: { id: String(${varName}._id) },
        data: _updateData2
      });
    }
    `.trim();
      }
    }
    
    console.log(`Could not infer model for ${varName} in ${file}`);
    return match; // leave unchanged if we can't infer
  });

  if (newContent !== original) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated ${file}`);
  }
});
