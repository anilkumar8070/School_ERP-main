const fs = require('fs');
let code = fs.readFileSync('routes/admitcards.js', 'utf8');

// Replace the fallback requires
code = code.replace(/const _Student = Student \|\| require\('\.\.\/models\/Student'\)/g, "const _Student = prisma.student;");
code = code.replace(/const _User = User \|\| require\('\.\.\/models\/User'\)/g, "const _User = prisma.user;");
code = code.replace(/const _AdmitCard = AdmitCard \|\| require\('\.\.\/models\/AdmitCard'\)/g, "const _AdmitCard = prisma.admitCard;");

// Replace the queries
code = code.replace(/_Student\.find\((.*?)\)/g, "_Student.findMany({ where: $1 })");
code = code.replace(/_User\.findOne\((.*?)\)/g, "_User.findFirst({ where: $1 })");
code = code.replace(/_AdmitCard\.create\(\{([\s\S]*?)\}\)/g, "_AdmitCard.create({ data: { $1 } })");
code = code.replace(/s\._id/g, "s.id");
code = code.replace(/u\._id/g, "u.id");

fs.writeFileSync('routes/admitcards.js', code);
console.log('Fixed admitcards.js');
