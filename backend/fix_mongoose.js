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

  // 1. Fix .populate()
  code = code.replace(/\}\)\.populate\('createdBy',\s*'name'\);/g, ", include: { createdBy: { select: { name: true } } }});");
  code = code.replace(/\}\)\.populate\('createdBy',\s*'name role'\);/g, ", include: { createdBy: { select: { name: true, role: true } } }});");
  code = code.replace(/\}\)\.populate\('([a-zA-Z0-9_]+)'\);/g, ", include: { $1: true }});");

  // 2. Fix _Model.findById(id)
  code = code.replace(/_([A-Za-z0-9_]+)\.findById\((.*?)\)/g, (match, model, arg) => {
    return `prisma.${toPrismaName(model)}.findUnique({ where: { id: String(${arg}) } })`;
  });

  // 3. Fix save() methods
  code = code.replace(/\/\*\s*FIXME:\s*Mongoose\s*\.save\(\)\s*\*\/\s*await\s+alloc\.save\(\);/g, "await prisma.hostelAllocation.update({ where: { id: alloc.id }, data: { /* specify fields if needed */ } });");
  code = code.replace(/\/\*\s*FIXME:\s*Mongoose\s*\.save\(\)\s*\*\/\s*await\s+doc\.save\(\);/g, "await prisma.reportCard.update({ where: { id: doc.id }, data: { filePath: doc.filePath, mime: doc.mime } });");
  
  // Note: in staff-salaryRoutes it's staffSalaryPayment, in salaryRoutes it's salaryPayment
  code = code.replace(/\/\*\s*FIXME:\s*Mongoose\s*\.save\(\)\s*\*\/\s*await\s+payment\.save\(\);/g, "/* FIXME manual */");

  code = code.replace(/await\s+doc\.save\(\)\.catch\(\(\)\s*=>\s*null\);/g, "await prisma.contactQuery.update({ where: { id: doc.id }, data: { notified: doc.notified, status: doc.status } }).catch(() => null);");
  code = code.replace(/await\s+receiptDoc\.save\(\)\.catch\(\(\)\s*=>\s*null\);/g, "await prisma.receipt.update({ where: { id: receiptDoc.id }, data: { status: receiptDoc.status, pdfUrl: receiptDoc.pdfUrl, pdfPath: receiptDoc.pdfPath } }).catch(() => null);");
  code = code.replace(/await\s+receipt\.save\(\)\.catch\(\(\)\s*=>\s*null\);/g, "await prisma.receipt.update({ where: { id: receipt.id }, data: { status: receipt.status, pdfUrl: receipt.pdfUrl, pdfPath: receipt.pdfPath } }).catch(() => null);");
  
  // pdfDoc.save() is PDFKit so leave it!
  
  if (code !== original) {
    fs.writeFileSync(filePath, code);
    console.log('Fixed', file);
  }
}
console.log('Done.');
