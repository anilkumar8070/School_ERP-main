module.exports = function(fileInfo, api, options) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  let dirty = false;

  root.find(j.Property, {
    key: { name: 'orderBy' }
  }).forEach(path => {
    const val = path.node.value;
    if (val.type === 'ObjectExpression' && val.properties.length > 1) {
      // Convert ObjectExpression to ArrayExpression of ObjectExpressions
      const arr = val.properties.map(prop => {
        return j.objectExpression([prop]);
      });
      path.node.value = j.arrayExpression(arr);
      dirty = true;
    }
  });

  return dirty ? root.toSource() : null;
};
