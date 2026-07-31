const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'routes', 'parentsRoutes.js');
let code = fs.readFileSync(file, 'utf8');

// fix student._id
code = code.replace(/student\._id/g, 'student.id || student._id');

// fix created._id
code = code.replace(/created\._id/g, 'created.id || created._id');

// fix s._id
code = code.replace(/s\._id/g, 's.id || s._id');

// fix user._id 
// Note: user._id is fine because we have an if (user.id) ... else if (user._id) check in the code.
// but let's make sure _id: in objects are handled.

fs.writeFileSync(file, code);
console.log('Fixed _id in parentsRoutes.js');
