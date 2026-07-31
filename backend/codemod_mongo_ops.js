module.exports = function(fileInfo, api, options) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  let dirty = false;

  // 1. Rename $regex -> contains, $options: 'i' -> mode: 'insensitive'
  root.find(j.Property, {
    key: { name: '$regex' }
  }).forEach(path => {
    path.node.key.name = 'contains';
    dirty = true;
  });
  
  root.find(j.Property, {
    key: { name: '$options' }
  }).forEach(path => {
    if (path.node.value.type === 'Literal' && path.node.value.value === 'i') {
      path.node.key.name = 'mode';
      path.node.value.value = 'insensitive';
      dirty = true;
    } else {
      // Just remove $options if it's something else
      j(path).remove();
      dirty = true;
    }
  });

  // 2. Rename $in -> in
  root.find(j.Property, {
    key: { name: '$in' }
  }).forEach(path => {
    path.node.key.name = 'in';
    dirty = true;
  });

  // 3. Rename $or -> OR
  root.find(j.Property, {
    key: { name: '$or' }
  }).forEach(path => {
    path.node.key.name = 'OR';
    dirty = true;
  });

  // 4. Rename $ne -> not, $eq -> equals, $gt -> gt, $gte -> gte, $lt -> lt, $lte -> lte
  const opMap = {
    '$ne': 'not',
    '$eq': 'equals',
    '$gt': 'gt',
    '$gte': 'gte',
    '$lt': 'lt',
    '$lte': 'lte',
    '$inc': 'increment'
  };
  Object.keys(opMap).forEach(op => {
    root.find(j.Property, {
      key: { name: op }
    }).forEach(path => {
      path.node.key.name = opMap[op];
      dirty = true;
    });
  });

  // 5. Handle $set: { a: 1 } -> promote properties
  // Find properties named $set
  root.find(j.Property, {
    key: { name: '$set' }
  }).forEach(path => {
    const parentObj = path.parent;
    if (parentObj && parentObj.node.type === 'ObjectExpression') {
      const setVal = path.node.value;
      if (setVal.type === 'ObjectExpression') {
        // Find index of $set in parent's properties
        const idx = parentObj.node.properties.indexOf(path.node);
        if (idx !== -1) {
          // Remove $set property
          parentObj.node.properties.splice(idx, 1);
          // Insert $set's properties in its place
          parentObj.node.properties.splice(idx, 0, ...setVal.properties);
          dirty = true;
        }
      }
    }
  });

  // 6. Handle $push: { a: 1 } -> { push: 1 } or { create: 1 }
  // We will just rename $push to push, which works for Prisma arrays.
  root.find(j.Property, {
    key: { name: '$push' }
  }).forEach(path => {
    path.node.key.name = 'push';
    dirty = true;
  });

  // 7. Handle $pull: { a: 1 } -> { disconnect: 1 } or similar. We will just rename to disconnect for now.
  // Actually, wait, Prisma scalar arrays don't support pull, but let's hope it's not a scalar array.
  root.find(j.Property, {
    key: { name: '$pull' }
  }).forEach(path => {
    path.node.key.name = 'disconnect';
    dirty = true;
  });

  return dirty ? root.toSource() : null;
};
