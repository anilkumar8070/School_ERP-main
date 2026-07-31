const fs = require('fs');
const path = require('path');

// Fix adminRoutes.js
const adminFile = path.join(__dirname, 'routes', 'adminRoutes.js');
let adminCode = fs.readFileSync(adminFile, 'utf8');

adminCode = adminCode.replace(/const\s+classes\s*=\s*await\s+Student\.distinct\('class'\);/, `
      const cQuery = await prisma.student.findMany({ select: { class: true }, distinct: ['class'] });
      const classes = cQuery.map(c => c.class);
`);

adminCode = adminCode.replace(/const\s+agg\s*=\s*await\s+Receipt\.aggregate\(\[\{\s*\$group:\s*\{\s*_id:\s*null,\s*total:\s*\{\s*\$sum:\s*'\$amount'\s*\}\s*\}\s*\}\]\);/, `
      const agg = await prisma.receipt.aggregate({ _sum: { amount: true } });
`);
adminCode = adminCode.replace(/feesTotal\s*=\s*agg\s*&&\s*agg\[0\]\s*&&\s*agg\[0\]\.total\s*\?\s*agg\[0\]\.total\s*:\s*0;/, `
      feesTotal = agg && agg._sum && agg._sum.amount ? agg._sum.amount : 0;
`);
fs.writeFileSync(adminFile, adminCode);

// Fix idcardsRoutes.js
const idCardsFile = path.join(__dirname, 'routes', 'idcardsRoutes.js');
let idCardsCode = fs.readFileSync(idCardsFile, 'utf8');

const idcAggRegex = /const agg = await IDCard\.aggregate\(\[\{[\s\S]*?\}\]\)\.catch\(\(\) => \[\]\);\s*const rows = agg\.map\(a => \(\{\s*batchId: a\._id,\s*count: a\.count,\s*class: a\.class,\s*section: a\.section,\s*date: a\.latestAt\s*\}\)\);/m;

idCardsCode = idCardsCode.replace(idcAggRegex, `
    const agg = await prisma.iDCard.groupBy({
      by: ['batchId', 'class', 'section'],
      where: match,
      _count: { batchId: true },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } }
    }).catch(() => []);
    const rows = agg.map(a => ({
      batchId: a.batchId,
      count: a._count.batchId,
      class: a.class,
      section: a.section,
      date: a._max.createdAt
    }));
`);

fs.writeFileSync(idCardsFile, idCardsCode);
console.log('Fixed aggregates and distincts!');
