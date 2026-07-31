module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  const models = new Set([
    'User', 'Complaint', 'Event', 'Syllabus', 'Leave', 'Message', 'Student', 'Faculty',
    'ContactQuery', 'DeletionRequest', 'Meeting', 'FeeStructure', 'Receipt', 'ReportCard',
    'Assignment', 'Submission', 'Timetable', 'FacultyRegistration', 'StudentRegistration',
    'PasswordReset', 'Attendance', 'FacultyAttendance', 'StaffAttendance', 'Mark', 'Notice',
    'Resource', 'TestSeries', 'ClassModel', 'TestResult', 'Question', 'SalaryPayment',
    'StaffSalaryPayment', 'IDCard', 'HostelAllocation', 'Hostel', 'FrontOffice',
    'AdmissionEnquiry', 'OnlineAdmission', 'Discount', 'LessonPlan', 'BehaviorRecord',
    'CustomForm', 'FormQuery', 'Gallery', 'Certificate', 'NotificationSettings',
    'TransportAllocation', 'TransportReceipt', 'ReceiptModel', '_AdmitCard'
  ]);

  root.find(j.CallExpression, {
    callee: {
      property: { name: 'create' }
    }
  }).forEach(path => {
    let isModel = false;
    if (path.node.callee.type === 'MemberExpression') {
      const obj = path.node.callee.object;
      if (obj.type === 'Identifier' && models.has(obj.name)) {
        isModel = true;
      } else if (obj.type === 'MemberExpression' && obj.object.type === 'Identifier' && obj.object.name === 'prisma') {
        isModel = true; // prisma.user.create
      }
    }

    if (!isModel) return;

    const args = path.node.arguments;
    if (args.length === 1) {
      const arg = args[0];
      // Check if it's already { data: ... }
      if (arg.type === 'ObjectExpression') {
        const hasDataProp = arg.properties.some(p => p.key && (p.key.name === 'data' || p.key.value === 'data'));
        if (!hasDataProp) {
          path.node.arguments = [
            j.objectExpression([
              j.property('init', j.identifier('data'), arg)
            ])
          ];
        }
      } else {
        // It's a variable. Wrap it in { data: arg }
        path.node.arguments = [
          j.objectExpression([
            j.property('init', j.identifier('data'), arg)
          ])
        ];
      }
    }
  });

  return root.toSource();
};
