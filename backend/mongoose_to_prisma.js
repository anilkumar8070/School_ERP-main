const prisma = require('./prisma/client');

function mapWhere(where) {
  if (!where) return undefined;
  const mapped = { ...where };
  if (mapped._id) {
    mapped.id = String(mapped._id);
    delete mapped._id;
  }
  if (mapped.$or) {
    mapped.OR = mapped.$or.map(mapWhere);
    delete mapped.$or;
  }
  for (let key in mapped) {
    if (mapped[key] && typeof mapped[key] === 'object' && !Array.isArray(mapped[key])) {
      const inner = mapped[key];
      if (inner.$regex) {
        let val = inner.$regex;
        if (typeof val === 'string') val = val.replace(/^\^|\$$/g, '');
        mapped[key] = {
          contains: val,
          mode: inner.$options === 'i' ? 'insensitive' : 'default'
        };
      } else if (inner.$in) {
        mapped[key] = { in: inner.$in };
      } else if (inner.$ne) {
        mapped[key] = { not: inner.$ne };
      }
    }
  }
  return mapped;
}

const allowedFieldsMap = {};
try {
  const { Prisma } = require('@prisma/client');
  Prisma.dmmf.datamodel.models.forEach(m => {
    allowedFieldsMap[m.name] = m.fields.map(f => f.name);
  });
} catch(e) {}

function mapData(data, pModel, isCreate = false) {
  if (!data) return undefined;
  const mapped = { ...data };
  if (mapped.$set) {
    Object.assign(mapped, mapped.$set);
    delete mapped.$set;
  }
  if (mapped.$push) delete mapped.$push;
  if (pModel && pModel.name) {
    const allowed = allowedFieldsMap[pModel.name];
    if (allowed) {
      for (const key in mapped) {
        if (!allowed.includes(key)) delete mapped[key];
      }
      if (allowed.includes('updatedAt') && !mapped.updatedAt) {
        mapped.updatedAt = new Date();
      }
      if (isCreate && allowed.includes('createdAt') && !mapped.createdAt) {
        mapped.createdAt = new Date();
      }
    }
  }
  return mapped;
}

function attachSave(doc, pModel, modelName) {
  if (!doc) return doc;
  doc.save = async () => {
    try {
      const data = { ...doc };
      delete data._id;
      delete data.id;
      delete data.save;
      delete data.toObject;
      // Remove Prisma relations/objects that might break update
      for (const k in data) {
        if (typeof data[k] === 'object' && data[k] !== null && !Array.isArray(data[k])) {
           if (!['assignedFees', 'parentOf'].includes(k)) {
              delete data[k];
           }
        }
      }
      const res = await pModel.update({ where: { id: String(doc._id || doc.id) }, data: mapData(data) });
      if (res) res._id = res.id;
      return attachSave(res, pModel, modelName);
    } catch (e) {
      console.error(`Error saving ${modelName}:`, e);
      throw e;
    }
  };
  doc.toObject = () => {
    const data = { ...doc };
    delete data.save;
    delete data.toObject;
    return data;
  };
  return doc;
}

function buildChainableQuery(pModel, modelName, operation, initialWhere, initialData = null) {
  let queryState = {
    where: mapWhere(initialWhere) || {},
    orderBy: undefined,
    take: undefined,
    skip: undefined
  };

  async function execute() {
    try {
      if (operation === 'findMany') {
        const res = await pModel.findMany(queryState);
        return res.map(r => attachSave({ ...r, _id: r.id }, pModel, modelName));
      } else if (operation === 'findFirst') {
        const res = await pModel.findFirst(queryState);
        if (res) res._id = res.id;
        return attachSave(res, pModel, modelName);
        return res;
      } else if (operation === 'count') {
        return await pModel.count({ where: queryState.where });
      } else if (operation === 'deleteMany') {
        return await pModel.deleteMany({ where: queryState.where });
      } else if (operation === 'updateMany') {
        return await pModel.updateMany({ where: queryState.where, data: mapData(initialData, pModel) });
      } else if (operation === 'updateUnique') {
        const res = await pModel.update({ where: queryState.where, data: mapData(initialData, pModel) });
        if (res) res._id = res.id;
        return attachSave(res, pModel, modelName);
      }
    } catch (e) {
      console.error(`Error in ${modelName}.${operation}:`, e);
      return operation === 'findMany' || operation === 'aggregate' ? [] : null;
    }
  }

  const chain = {
    sort: (sortObj) => {
      if (sortObj) {
        const orderBy = [];
        for (const [key, val] of Object.entries(sortObj)) {
          if (val === -1 || val === 'desc') {
            orderBy.push({ [key]: { sort: 'desc', nulls: 'last' } });
          } else {
            orderBy.push({ [key]: { sort: 'asc', nulls: 'last' } });
          }
        }
        queryState.orderBy = orderBy.length === 1 ? orderBy[0] : orderBy;
      }
      return chain;
    },
    limit: (num) => {
      queryState.take = Number(num);
      return chain;
    },
    skip: (num) => {
      queryState.skip = Number(num);
      return chain;
    },
    populate: () => chain,
    select: () => chain,
    lean: () => chain,
    exec: () => execute(),
    then: (resolve, reject) => execute().then(resolve, reject),
    catch: (reject) => execute().catch(reject)
  };

  return chain;
}

function createWrapper(modelName, overrideKey = null) {
  const modelKey = overrideKey || (modelName.charAt(0).toLowerCase() + modelName.slice(1));
  const pModel = prisma[modelKey];
  if (!pModel) {
    console.warn(`Prisma model not found for: ${modelName}`);
    return {};
  }

  return {
    findOne: (where) => buildChainableQuery(pModel, modelName, 'findFirst', where),
    find: (where) => buildChainableQuery(pModel, modelName, 'findMany', where),
    countDocuments: (where) => buildChainableQuery(pModel, modelName, 'count', where),
    deleteOne: (where) => buildChainableQuery(pModel, modelName, 'deleteMany', where),
    deleteMany: (where) => buildChainableQuery(pModel, modelName, 'deleteMany', where),
    updateOne: (where, data) => buildChainableQuery(pModel, modelName, 'updateMany', where, data),
    updateMany: (where, data) => buildChainableQuery(pModel, modelName, 'updateMany', where, data),
    findById: (id) => buildChainableQuery(pModel, modelName, 'findFirst', { _id: id }),
    findByIdAndUpdate: (id, data) => buildChainableQuery(pModel, modelName, 'updateUnique', { _id: id }, data),
    findByIdAndDelete: (id) => buildChainableQuery(pModel, modelName, 'deleteMany', { _id: id }),
    create: async (data) => {
      try {
        let payload = data;
        if (data && data.data !== undefined && !data.data.data) {
           payload = data.data;
        }
        const res = await pModel.create({ data: mapData(payload, pModel, true) });
        if (res) res._id = res.id;
        return attachSave(res, pModel, modelName);
      } catch (e) {
        console.error(`Error in ${modelName}.create:`, e);
        return null;
      }
    },
    aggregate: () => buildChainableQuery(pModel, modelName, 'findMany', {})
  };
}

module.exports = {
  User: createWrapper('User'),
  Complaint: createWrapper('Complaint'),
  Event: createWrapper('Event'),
  Syllabus: createWrapper('Syllabus'),
  Leave: createWrapper('Leave'),
  Message: createWrapper('Message'),
  Student: createWrapper('Student'),
  Faculty: createWrapper('Faculty'),
  ContactQuery: createWrapper('ContactQuery'),
  DeletionRequest: createWrapper('DeletionRequest'),
  Meeting: createWrapper('Meeting'),
  FeeStructure: createWrapper('FeeStructure'),
  Receipt: createWrapper('Receipt'),
  ReportCard: createWrapper('ReportCard'),
  Assignment: createWrapper('Assignment'),
  Submission: createWrapper('Submission'),
  Timetable: createWrapper('Timetable'),
  FacultyRegistration: createWrapper('FacultyRegistration'),
  StudentRegistration: createWrapper('StudentRegistration'),
  PasswordReset: createWrapper('PasswordReset'),
  Attendance: createWrapper('Attendance'),
  FacultyAttendance: createWrapper('FacultyAttendance'),
  StaffAttendance: createWrapper('StaffAttendance'),
  Mark: createWrapper('Mark'),
  Notice: createWrapper('Notice'),
  Resource: createWrapper('Resource'),
  TestSeries: createWrapper('TestSeries'),
  ClassModel: createWrapper('ClassModel', 'class'),
  TestResult: createWrapper('TestResult'),
  Question: createWrapper('Question'),
  SalaryPayment: createWrapper('SalaryPayment'),
  StaffSalaryPayment: createWrapper('StaffSalaryPayment'),
  IDCard: createWrapper('IDCard'),
  HostelAllocation: createWrapper('HostelAllocation'),
  Hostel: createWrapper('Hostel'),
  FrontOffice: createWrapper('FrontOffice'),
  AdmissionEnquiry: createWrapper('AdmissionEnquiry'),
  OnlineAdmission: createWrapper('OnlineAdmission'),
  Discount: createWrapper('Discount'),
  LessonPlan: createWrapper('LessonPlan'),
  BehaviorRecord: createWrapper('BehaviorRecord'),
  CustomForm: createWrapper('CustomForm'),
  FormQuery: createWrapper('FormQuery'),
  Gallery: createWrapper('Gallery'),
  Certificate: createWrapper('Certificate'),
  NotificationSettings: createWrapper('NotificationSettings'),
  TransportAllocation: createWrapper('TransportAllocation'),
  TransportReceipt: createWrapper('TransportReceipt'),
  ReceiptModel: createWrapper('ReceiptModel', 'receipt'),
  AdmitCard: createWrapper('AdmitCard')
};
