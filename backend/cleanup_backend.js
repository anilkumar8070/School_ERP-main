const fs = require('fs');
const path = require('path');
const routesDir = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const p = path.join(routesDir, file);
  let code = fs.readFileSync(p, 'utf8');
  let original = code;

  // Replace standard object property access: obj._id -> obj.id
  // But avoid replacing in transpiled save blocks first.
  
  // We can just replace `\._id` with `.id` EXCEPT where it says `_id:` or `{ _id` or `} else if (.*_id)`
  
  // First, completely clean up the Transpiled save() blocks!
  // The transpiled save blocks look like:
  /*
    if (doc && doc.id) {
      const { id: _id_unused, ..._updateData } = doc;
      await prisma.modelName.update({
        where: { id: String(doc.id) },
        data: _updateData
      });
    } else if (doc && doc._id) {
      const { _id: _id_unused2, ..._updateData2 } = doc;
      await prisma.modelName.update({
        where: { id: String(doc._id) },
        data: _updateData2
      });
    }
  */
  // We can replace the whole block with just:
  /*
    if (doc) {
      const { id, _id, ..._updateData } = doc;
      await prisma.modelName.update({
        where: { id: String(id || _id) },
        data: _updateData
      });
    }
  */
  
  const saveBlockRegex = /if\s*\(([\w]+)\s*&&\s*\1\.id\)\s*\{\s*const\s*\{\s*id:\s*_id_unused,\s*\.\.\.(_updateData[\w]*)\s*\}\s*=\s*\1;\s*await\s+prisma\.([\w]+)\.update\(\{\s*where:\s*\{\s*id:\s*String\(\1\.id\)\s*\}\,\s*data:\s*\2\s*\}\);\s*\}\s*else\s*if\s*\(\1\s*&&\s*\1\._id\)\s*\{\s*const\s*\{\s*_id:\s*_id_unused2,\s*\.\.\.(_updateData[\w]*)\s*\}\s*=\s*\1;\s*await\s+prisma\.\3\.update\(\{\s*where:\s*\{\s*id:\s*String\(\1\._id\)\s*\}\,\s*data:\s*\4\s*\}\);\s*\}/g;

  code = code.replace(saveBlockRegex, (match, docName, updateData1, modelName, updateData2) => {
    return `if (${docName}) {
      const { id: _unused_id, _id: _unused__id, save: _unused_save, toObject: _unused_toObject, ..._updateData } = ${docName};
      
      // Clean out relational arrays if any to prevent Prisma crash
      for (const k in _updateData) {
        if (Array.isArray(_updateData[k]) && _updateData[k].length > 0 && typeof _updateData[k][0] === 'object') {
           delete _updateData[k];
        }
      }

      await prisma.${modelName}.update({
        where: { id: String(${docName}.id || ${docName}._id) },
        data: _updateData
      }).catch(e => console.error("Transpiled save error:", e.message));
    }`;
  });

  // Now replace obj._id with obj.id || obj._id everywhere, but safely.
  // We match word._id where word is not empty, and ensure we don't break obj.id || obj._id which might already exist!
  // Let's first undo any previous "id || _id" to prevent duplication.
  code = code.replace(/([\w]+)\.id\s*\|\|\s*\1\._id/g, '$1._id');
  
  // Now safely convert `word._id` to `(word.id || word._id)`
  // Wait, if it's `doc._id ? ...` or `String(s._id)`, we can just replace `word._id` with `(word.id || word._id)`
  // EXCEPT in object literals `{ _id: ... }` which is caught by regex because there's no word character before the dot.
  // So `\b([a-zA-Z0-9_]+)\._id\b` will match `student._id`, `doc._id`, `a._id`.
  
  code = code.replace(/\b([a-zA-Z0-9_]+)\._id\b/g, '($1.id || $1._id)');

  // Fix any `{ _id: ... }` to `{ id: ... }` for Prisma queries (but NOT inside MongoDB aggregate pipelines!)
  // If we have Prisma queries like `where: { _id: id }` -> `where: { id: id }`
  code = code.replace(/where:\s*\{\s*_id:/g, 'where: { id:');

  if (code !== original) {
    fs.writeFileSync(p, code);
    console.log('Cleaned up', file);
  }
});
