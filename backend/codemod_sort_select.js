module.exports = function(fileInfo, api, options) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  let dirty = false;

  // Helper to find the root prisma call (findMany, findUnique, etc)
  function getRootCall(path) {
    let current = path;
    while (current && current.type === 'CallExpression') {
      if (current.callee && current.callee.type === 'MemberExpression') {
        const propName = current.callee.property.name;
        if (['findMany', 'findUnique', 'findFirst'].includes(propName)) {
          return current;
        }
        current = current.callee.object;
      } else {
        break;
      }
    }
    return null;
  }

  // 1. Handle .sort({ field: 1/-1 })
  root.find(j.CallExpression, {
    callee: {
      type: 'MemberExpression',
      property: { name: 'sort' }
    }
  }).forEach(path => {
    const rootCall = getRootCall(path.node.callee.object);
    if (rootCall) {
      const sortArg = path.node.arguments[0];
      if (sortArg && sortArg.type === 'ObjectExpression') {
        // Transform 1/-1 to 'asc'/'desc'
        sortArg.properties.forEach(prop => {
          if (prop.value && prop.value.type === 'UnaryExpression' && prop.value.operator === '-' && prop.value.argument.value === 1) {
            prop.value = j.literal('desc');
          } else if (prop.value && prop.value.type === 'Literal' && prop.value.value === 1) {
            prop.value = j.literal('asc');
          } else if (prop.value && prop.value.type === 'Literal' && prop.value.value === -1) {
            prop.value = j.literal('desc');
          }
        });

        let innerArgs = rootCall.arguments;
        if (innerArgs.length === 0) {
          innerArgs.push(j.objectExpression([
            j.property('init', j.identifier('orderBy'), sortArg)
          ]));
        } else if (innerArgs[0].type === 'ObjectExpression') {
          innerArgs[0].properties.push(
            j.property('init', j.identifier('orderBy'), sortArg)
          );
        }
        
        j(path).replaceWith(path.node.callee.object);
        dirty = true;
      }
    }
  });

  // 2. Handle .select('field1 field2')
  root.find(j.CallExpression, {
    callee: {
      type: 'MemberExpression',
      property: { name: 'select' }
    }
  }).forEach(path => {
    const rootCall = getRootCall(path.node.callee.object);
    if (rootCall) {
      const selectArg = path.node.arguments[0];
      if (selectArg && selectArg.type === 'Literal' && typeof selectArg.value === 'string') {
        const fields = selectArg.value.split(/\s+/).filter(Boolean);
        const selectObj = j.objectExpression(
          fields.map(f => {
            let fieldName = f === '_id' ? 'id' : f;
            return j.property('init', j.identifier(fieldName), j.literal(true));
          })
        );
        
        let innerArgs = rootCall.arguments;
        if (innerArgs.length === 0) {
          innerArgs.push(j.objectExpression([
            j.property('init', j.identifier('select'), selectObj)
          ]));
        } else if (innerArgs[0].type === 'ObjectExpression') {
          innerArgs[0].properties.push(
            j.property('init', j.identifier('select'), selectObj)
          );
        }
        
        j(path).replaceWith(path.node.callee.object);
        dirty = true;
      }
    }
  });

  return dirty ? root.toSource() : null;
};
