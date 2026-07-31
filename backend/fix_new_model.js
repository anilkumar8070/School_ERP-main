const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

function toPrismaName(name) {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

for (const file of files) {
  const filePath = path.join(routesDir, file);
  let code = fs.readFileSync(filePath, 'utf8');
  const original = code;

  // Match const/let varName = new Model(args)
  const regex = /(const|let)\s+([A-Za-z0-9_]+)\s*=\s*new\s+([A-Z_][a-zA-Z0-9_]*)\((.*?)\)/g;
  
  code = code.replace(regex, (match, keyword, varName, model, args) => {
    const ignoredModels = ['Map', 'Date', 'RegExp', 'Error', 'Promise', 'PDFDocument', '_PDFDocument', 'Razorpay', 'Set'];
    if (ignoredModels.includes(model)) return match;
    
    const actualModel = model.startsWith('_') ? model.slice(1) : model;
    const pModel = toPrismaName(actualModel);
    
    return `${keyword} ${varName} = await prisma.${pModel}.create({ data: ${args || '{}'} })`;
  });

  if (code !== original) {
    fs.writeFileSync(filePath, code);
    console.log('Fixed', file);
  }
}
console.log('Done.');
