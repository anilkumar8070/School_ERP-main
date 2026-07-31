const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'routes', 'financeRoutes.js');
let code = fs.readFileSync(file, 'utf8');

// Replace Term1 Update
code = code.replace(/if\s*\(hasT1\)\s*\{\s*await Student\.updateOne\(\{\s*_id:\s*id,\s*'assignedFees\.term':\s*'Term1'\s*\},\s*\{\s*'assignedFees\.\$\.amount':\s*Number\(term1\),\s*'assignedFees\.\$\.assignedAt':\s*new Date\(\),\s*'assignedFees\.\$\.by':\s*actor\s*\}\);\s*\}\s*else\s*\{\s*await Student\.updateOne\(\{\s*_id:\s*id\s*\},\s*\{\s*push:\s*\{\s*assignedFees:\s*\{\s*term:\s*'Term1',\s*amount:\s*Number\(term1\),\s*note:\s*String\(note \|\| ''\),\s*by:\s*actor,\s*assignedAt:\s*new Date\(\)\s*\}\s*\}\s*\}\);\s*\}/, `
            let fees = Array.isArray(s.assignedFees) ? s.assignedFees : [];
            const idx = fees.findIndex(f => String(f.term).toLowerCase().replace(/\\s+/g, '') === 'term1');
            if (idx !== -1) {
               fees[idx].amount = Number(term1);
               fees[idx].assignedAt = new Date();
               fees[idx].by = actor;
            } else {
               fees.push({ term: 'Term1', amount: Number(term1), note: String(note || ''), by: actor, assignedAt: new Date() });
            }
            await prisma.student.update({ where: { id }, data: { assignedFees: fees } });
`);

// Replace Term2 Update
code = code.replace(/if\s*\(hasT2\)\s*\{\s*await Student\.updateOne\(\{\s*_id:\s*id,\s*'assignedFees\.term':\s*'Term2'\s*\},\s*\{\s*'assignedFees\.\$\.amount':\s*Number\(term2\),\s*'assignedFees\.\$\.assignedAt':\s*new Date\(\),\s*'assignedFees\.\$\.by':\s*actor\s*\}\);\s*\}\s*else\s*\{\s*await Student\.updateOne\(\{\s*_id:\s*id\s*\},\s*\{\s*push:\s*\{\s*assignedFees:\s*\{\s*term:\s*'Term2',\s*amount:\s*Number\(term2\),\s*note:\s*String\(note \|\| ''\),\s*by:\s*actor,\s*assignedAt:\s*new Date\(\)\s*\}\s*\}\s*\}\);\s*\}/, `
            let fees2 = Array.isArray(s.assignedFees) ? s.assignedFees : [];
            const idx2 = fees2.findIndex(f => String(f.term).toLowerCase().replace(/\\s+/g, '') === 'term2');
            if (idx2 !== -1) {
               fees2[idx2].amount = Number(term2);
               fees2[idx2].assignedAt = new Date();
               fees2[idx2].by = actor;
            } else {
               fees2.push({ term: 'Term2', amount: Number(term2), note: String(note || ''), by: actor, assignedAt: new Date() });
            }
            await prisma.student.update({ where: { id }, data: { assignedFees: fees2 } });
`);

// Replace Term1 Removal
code = code.replace(/\/\/\s*remove Term1 assignment if amount is 0\s*await Student\.updateMany\(studentQuery,\s*\{\s*disconnect:\s*\{\s*assignedFees:\s*\{\s*term:\s*'Term1'\s*\}\s*\}\s*\}\);/, `
          // remove Term1 assignment if amount is 0
          const studentsToRemove = await prisma.student.findMany({ where: studentQuery });
          for (const sToRemove of studentsToRemove) {
             let fees = Array.isArray(sToRemove.assignedFees) ? sToRemove.assignedFees : [];
             const filtered = fees.filter(f => String(f.term).toLowerCase().replace(/\\s+/g, '') !== 'term1');
             await prisma.student.update({ where: { id: sToRemove.id }, data: { assignedFees: filtered } });
          }
`);

// Replace Term2 Removal
code = code.replace(/\/\/\s*remove Term2 assignment if amount is 0\s*await Student\.updateMany\(studentQuery,\s*\{\s*disconnect:\s*\{\s*assignedFees:\s*\{\s*term:\s*'Term2'\s*\}\s*\}\s*\}\);/, `
          // remove Term2 assignment if amount is 0
          const studentsToRemove2 = await prisma.student.findMany({ where: studentQuery });
          for (const sToRemove of studentsToRemove2) {
             let fees = Array.isArray(sToRemove.assignedFees) ? sToRemove.assignedFees : [];
             const filtered = fees.filter(f => String(f.term).toLowerCase().replace(/\\s+/g, '') !== 'term2');
             await prisma.student.update({ where: { id: sToRemove.id }, data: { assignedFees: filtered } });
          }
`);

// Replace Auto-propagate Term1
code = code.replace(/if\s*\(Number\(term1 \|\| 0\)\s*>\s*0\)\s*await Student\.updateMany\(studentQuery,\s*\{\s*push:\s*\{\s*assignedFees:\s*\{\s*term:\s*'Term1',\s*amount:\s*Number\(term1\),\s*note:\s*String\(note \|\| ''\),\s*by:\s*actor,\s*assignedAt:\s*new Date\(\)\s*\}\s*\}\s*\}\);/, `
      if (Number(term1 || 0) > 0) {
          const students = await prisma.student.findMany({ where: studentQuery });
          for (const s of students) {
             let fees = Array.isArray(s.assignedFees) ? s.assignedFees : [];
             fees.push({ term: 'Term1', amount: Number(term1), note: String(note || ''), by: actor, assignedAt: new Date() });
             await prisma.student.update({ where: { id: s.id }, data: { assignedFees: fees } });
          }
      }
`);

// Replace Auto-propagate Term2
code = code.replace(/if\s*\(Number\(term2 \|\| 0\)\s*>\s*0\)\s*await Student\.updateMany\(studentQuery,\s*\{\s*push:\s*\{\s*assignedFees:\s*\{\s*term:\s*'Term2',\s*amount:\s*Number\(term2\),\s*note:\s*String\(note \|\| ''\),\s*by:\s*actor,\s*assignedAt:\s*new Date\(\)\s*\}\s*\}\s*\}\);/, `
      if (Number(term2 || 0) > 0) {
          const students = await prisma.student.findMany({ where: studentQuery });
          for (const s of students) {
             let fees = Array.isArray(s.assignedFees) ? s.assignedFees : [];
             fees.push({ term: 'Term2', amount: Number(term2), note: String(note || ''), by: actor, assignedAt: new Date() });
             await prisma.student.update({ where: { id: s.id }, data: { assignedFees: fees } });
          }
      }
`);

// Replace Push assignedFees entry
code = code.replace(/\/\/\s*Push assignedFees entry to matching students\s*const r = await Student\.updateMany\(q,\s*\{\s*push:\s*\{\s*assignedFees:\s*entry\s*\}\s*\}\);/, `
    // Push assignedFees entry to matching students
    let matchedCount = 0;
    const targets = await prisma.student.findMany({ where: q });
    for (const s of targets) {
       let fees = Array.isArray(s.assignedFees) ? s.assignedFees : [];
       fees.push(entry);
       await prisma.student.update({ where: { id: s.id }, data: { assignedFees: fees } });
       matchedCount++;
    }
    const r = { matchedCount, modifiedCount: matchedCount };
`);

fs.writeFileSync(file, code);
console.log('Fixed financeRoutes.js!');
