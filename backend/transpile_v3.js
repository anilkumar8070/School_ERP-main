const fs = require('fs');
const path = require('path');

function toPrismaName(name) {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function transpileFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  const original = code;

  // 1. Remove Mongoose require and add Prisma require
  code = code.replace(/const\s+\{\s*([A-Za-z0-9_,\s]+)\s*\}\s*=\s*require\(['"]\.\.\/models\/[^'"]+['"]\);/g, '');
  code = code.replace(/const\s+([A-Za-z0-9_]+)\s*=\s*require\(['"]\.\.\/models\/[^'"]+['"]\);/g, '');
  
  if (!code.includes("require('../prisma/client')") && !code.includes('require("./prisma/client")')) {
    let clientPath = filePath.includes('routes') ? '../prisma/client' : './prisma/client';
    code = `const prisma = require('${clientPath}');\n` + code;
  }

  // 2. Chained Methods removal: .lean() and .exec()
  code = code.replace(/\.lean\(\)/g, '');
  code = code.replace(/\.exec\(\)/g, '');

  // 3. new Model() + save()
  // Replace `const doc = new Model(data); await doc.save();` with `const doc = await prisma.model.create({ data });`
  // This is a naive regex but it works for standard patterns: `const doc = new ContactQuery(req.body);`
  code = code.replace(/const\s+([A-Za-z0-9_]+)\s*=\s*new\s+([A-Z][a-zA-Z0-9_]*)\((.*?)\);([\s\S]*?)await\s+\1\.save\(\);/g, (match, varName, model, args, between) => {
    return `const ${varName} = await prisma.${toPrismaName(model)}.create({ data: ${args} });${between}`;
  });

  // Handle doc.save() where it was fetched (e.g. update)
  code = code.replace(/await\s+([A-Za-z0-9_]+)\.save\(\);/g, (match, varName) => {
    // We can't automatically know the model. But we can comment it out and leave a FIXME.
    // Actually, in many places it's `doc.save()`. Prisma updates usually look like `await prisma.model.update(...)`
    return `/* FIXME: Mongoose .save() */ await ${varName}.save();`;
  });

  // 4. Model.find({ ... }).populate('ref')
  // Prisma doesn't chain. We must parse out the populate/sort and put them inside the object.
  // Instead of complex AST, we replace basic queries first:
  
  const models = ['User', 'Complaint', 'Event', 'Syllabus', 'Leave', 'Message', 'Student', 'Faculty',
    'ContactQuery', 'DeletionRequest', 'Meeting', 'FeeStructure', 'Receipt', 'ReportCard',
    'Assignment', 'Submission', 'Timetable', 'FacultyRegistration', 'StudentRegistration',
    'PasswordReset', 'Attendance', 'FacultyAttendance', 'StaffAttendance', 'Mark', 'Notice',
    'Resource', 'TestSeries', 'ClassModel', 'TestResult', 'Question', 'SalaryPayment',
    'StaffSalaryPayment', 'IDCard', 'HostelAllocation', 'Hostel', 'FrontOffice',
    'AdmissionEnquiry', 'OnlineAdmission', 'Discount', 'LessonPlan', 'BehaviorRecord',
    'CustomForm', 'FormQuery', 'Gallery', 'Certificate', 'NotificationSettings',
    'TransportAllocation', 'TransportReceipt', 'ReceiptModel'];

  for (const model of models) {
    const pModel = toPrismaName(model);

    // .findByIdAndUpdate(id, data)
    code = code.replace(new RegExp(`\\b${model}\\.findByIdAndUpdate\\((.*?),(.*?)(?:,(.*?))?\\)`, 'g'), (match, id, data) => {
      return `prisma.${pModel}.update({ where: { id: String(${id}) }, data: ${data} })`;
    });

    // .findByIdAndDelete(id)
    code = code.replace(new RegExp(`\\b${model}\\.findByIdAndDelete\\((.*?)\\)`, 'g'), (match, id) => {
      return `prisma.${pModel}.delete({ where: { id: String(${id}) } })`;
    });

    // .findById(id)
    code = code.replace(new RegExp(`\\b${model}\\.findById\\((.*?)\\)`, 'g'), (match, id) => {
      return `prisma.${pModel}.findUnique({ where: { id: String(${id}) } })`;
    });

    // .findOne(where)
    code = code.replace(new RegExp(`\\b${model}\\.findOne\\((.*?)\\)`, 'g'), (match, where) => {
      if (!where.trim() || where.trim() === '{}') return `prisma.${pModel}.findFirst()`;
      return `prisma.${pModel}.findFirst({ where: ${where} })`;
    });

    // .find(where)
    code = code.replace(new RegExp(`\\b${model}\\.find\\((.*?)\\)`, 'g'), (match, where) => {
      if (!where.trim() || where.trim() === '{}') return `prisma.${pModel}.findMany()`;
      return `prisma.${pModel}.findMany({ where: ${where} })`;
    });

    // .create(data)
    code = code.replace(new RegExp(`\\b${model}\\.create\\((.*?)\\)`, 'g'), (match, data) => {
      return `prisma.${pModel}.create({ data: ${data} })`;
    });

    // .countDocuments(where)
    code = code.replace(new RegExp(`\\b${model}\\.countDocuments\\((.*?)\\)`, 'g'), (match, where) => {
      if (!where.trim() || where.trim() === '{}') return `prisma.${pModel}.count()`;
      return `prisma.${pModel}.count({ where: ${where} })`;
    });
    
    // .insertMany(data)
    code = code.replace(new RegExp(`\\b${model}\\.insertMany\\((.*?)\\)`, 'g'), (match, data) => {
      return `prisma.${pModel}.createMany({ data: ${data} })`;
    });
    
    // .deleteMany(where)
    code = code.replace(new RegExp(`\\b${model}\\.deleteMany\\((.*?)\\)`, 'g'), (match, where) => {
      if (!where.trim() || where.trim() === '{}') return `prisma.${pModel}.deleteMany()`;
      return `prisma.${pModel}.deleteMany({ where: ${where} })`;
    });
  }

  // 5. Replace chained .populate('ref') by finding findMany/findUnique with args
  // This is hacky but might work for simple cases. e.g. prisma.model.findMany({where: ...}).populate('ref')
  // We will change `.populate('ref')` to `.include('ref')` which doesn't exist, but then we fix it.
  // Honestly, writing a parser is better.
  
  if (code !== original) {
    fs.writeFileSync(filePath, code);
    console.log(`Transpiled ${path.basename(filePath)}`);
  }
}

const dir = path.join(__dirname, 'routes');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
files.forEach(f => transpileFile(path.join(dir, f)));

transpileFile(path.join(__dirname, 'index.js'));
