module.exports = function (fileInfo, api, options) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  // Helper to lowercase first letter for Prisma models
  const toPrismaName = (name) => name.charAt(0).toLowerCase() + name.slice(1);

  // 1. Remove Mongoose require and add Prisma require
  // Not strictly needed via AST if we just prepend/replace strings, but we can do it:
  let hasPrisma = false;
  root.find(j.VariableDeclaration).forEach((path) => {
    if (j(path).toSource().includes("prisma/client")) {
      hasPrisma = true;
    }
  });

  if (!hasPrisma) {
    const isRoute = fileInfo.path.includes('routes');
    const prismaPath = isRoute ? '../prisma/client' : './prisma/client';
    root.get().node.program.body.unshift(
      j.variableDeclaration('const', [
        j.variableDeclarator(j.identifier('prisma'), j.callExpression(j.identifier('require'), [j.literal(prismaPath)]))
      ])
    );
  }

  // Remove require models (const { User } = require('../models/...'))
  root.find(j.VariableDeclarator).forEach(path => {
    if (
      path.node.init &&
      path.node.init.type === 'CallExpression' &&
      path.node.init.callee.name === 'require' &&
      path.node.init.arguments.length === 1 &&
      typeof path.node.init.arguments[0].value === 'string' &&
      path.node.init.arguments[0].value.includes('/models/')
    ) {
      j(path).remove();
    }
  });

  const models = ['User', 'Complaint', 'Event', 'Syllabus', 'Leave', 'Message', 'Student', 'Faculty',
    'ContactQuery', 'DeletionRequest', 'Meeting', 'FeeStructure', 'Receipt', 'ReportCard',
    'Assignment', 'Submission', 'Timetable', 'FacultyRegistration', 'StudentRegistration',
    'PasswordReset', 'Attendance', 'FacultyAttendance', 'StaffAttendance', 'Mark', 'Notice',
    'Resource', 'TestSeries', 'ClassModel', 'TestResult', 'Question', 'SalaryPayment',
    'StaffSalaryPayment', 'IDCard', 'HostelAllocation', 'Hostel', 'FrontOffice',
    'AdmissionEnquiry', 'OnlineAdmission', 'Discount', 'LessonPlan', 'BehaviorRecord',
    'CustomForm', 'FormQuery', 'Gallery', 'Certificate', 'NotificationSettings',
    'TransportAllocation', 'TransportReceipt', 'ReceiptModel'];

  // 2. Transform new Model(args) + doc.save() to prisma.model.create({ data: args })
  root.find(j.VariableDeclarator, {
    init: { type: 'NewExpression' }
  }).forEach(path => {
    const newExpr = path.node.init;
    if (newExpr.callee && newExpr.callee.type === 'Identifier' && models.includes(newExpr.callee.name)) {
      const modelName = toPrismaName(newExpr.callee.name);
      // We assume they pass an object to the constructor: new User(req.body)
      const dataArg = newExpr.arguments[0] || j.objectExpression([]);
      
      const createCall = j.awaitExpression(
        j.callExpression(
          j.memberExpression(
            j.memberExpression(j.identifier('prisma'), j.identifier(modelName)),
            j.identifier('create')
          ),
          [j.objectExpression([j.property('init', j.identifier('data'), dataArg)])]
        )
      );
      
      path.node.init = createCall;
      
      // Now find and remove `X.save()`
      const varName = path.node.id.name;
      root.find(j.CallExpression, {
        callee: {
          type: 'MemberExpression',
          object: { name: varName },
          property: { name: 'save' }
        }
      }).forEach(savePath => {
        // If it's `await X.save()`, remove the whole await expression statement
        if (savePath.parentPath.node.type === 'AwaitExpression') {
          j(savePath.parentPath.parentPath).remove();
        } else {
          j(savePath.parentPath).remove();
        }
      });
    }
  });

  // 3. Transform Model.find(where), findOne(where), etc.
  root.find(j.CallExpression, {
    callee: {
      type: 'MemberExpression',
      object: { type: 'Identifier' }
    }
  }).forEach(path => {
    const objName = path.node.callee.object.name;
    const propName = path.node.callee.property.name;
    
    // Check if it's a model
    if (models.includes(objName)) {
      const prismaModel = toPrismaName(objName);
      let newMethod = propName;
      let args = path.node.arguments;
      let prismaArgs = {};

      const hasWhereArg = args.length > 0 && !(args[0].type === 'ObjectExpression' && args[0].properties.length === 0);

      if (propName === 'find') {
        newMethod = 'findMany';
        if (hasWhereArg) prismaArgs.where = args[0];
      } else if (propName === 'findOne') {
        newMethod = 'findFirst';
        if (hasWhereArg) prismaArgs.where = args[0];
      } else if (propName === 'findById') {
        newMethod = 'findUnique';
        prismaArgs.where = j.objectExpression([
          j.property('init', j.identifier('id'), j.callExpression(j.identifier('String'), [args[0]]))
        ]);
      } else if (propName === 'create') {
        newMethod = 'create';
        prismaArgs.data = args[0];
      } else if (propName === 'findByIdAndUpdate') {
        newMethod = 'update';
        prismaArgs.where = j.objectExpression([
          j.property('init', j.identifier('id'), j.callExpression(j.identifier('String'), [args[0]]))
        ]);
        if (args.length > 1) prismaArgs.data = args[1];
      } else if (propName === 'findByIdAndDelete') {
        newMethod = 'delete';
        prismaArgs.where = j.objectExpression([
          j.property('init', j.identifier('id'), j.callExpression(j.identifier('String'), [args[0]]))
        ]);
      } else if (propName === 'countDocuments') {
        newMethod = 'count';
        if (hasWhereArg) prismaArgs.where = args[0];
      }

      if (newMethod !== propName) {
        path.node.callee.object = j.memberExpression(j.identifier('prisma'), j.identifier(prismaModel));
        path.node.callee.property.name = newMethod;
        
        if (Object.keys(prismaArgs).length > 0) {
          const props = [];
          if (prismaArgs.where) props.push(j.property('init', j.identifier('where'), prismaArgs.where));
          if (prismaArgs.data) props.push(j.property('init', j.identifier('data'), prismaArgs.data));
          path.node.arguments = [j.objectExpression(props)];
        } else {
          path.node.arguments = [];
        }
      }
    }
  });

  // 4. Remove .lean(), .exec() and convert .populate('ref') to include
  // This requires finding MemberExpressions on the result of queries
  let dirty = true;
  while(dirty) {
    dirty = false;
    root.find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        property: { type: 'Identifier' }
      }
    }).forEach(path => {
      const propName = path.node.callee.property.name;
      if (propName === 'lean' || propName === 'exec') {
        // replace `X.lean()` with `X`
        j(path).replaceWith(path.node.callee.object);
        dirty = true;
      }
    });
  }

  return root.toSource();
};
