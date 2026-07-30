const prisma = require('../prisma/client');


const express = require('express');


module.exports = function(helpers) {
  const router = express.Router();
  
  const { 
    User, Complaint, Event, Syllabus, Leave, Message, Student, Faculty,
    ContactQuery, DeletionRequest, Meeting, FeeStructure, Receipt, ReportCard,
    Assignment, Submission, Timetable, FacultyRegistration, StudentRegistration,
    PasswordReset, Attendance, FacultyAttendance, StaffAttendance, Mark, Notice,
    Resource, TestSeries, ClassModel, TestResult, Question, SalaryPayment,
    StaffSalaryPayment, IDCard, HostelAllocation, Hostel, FrontOffice,
    AdmissionEnquiry, OnlineAdmission, Discount, LessonPlan, BehaviorRecord,
    CustomForm, FormQuery, Gallery, Certificate, NotificationSettings,
    TransportAllocation, TransportReceipt, ReceiptModel,
    verifyToken, requireRole, generateReceiptPdf, generateReportCardPdf,
    generateAdmitCardPdf, generateIDCardPdf, generateHostelReceiptPdf,
    generateSalaryReceiptPdf, upload, transporter, generateCertificatePdf,
    similarity, PDFDocument, fs, path, bcrypt, jwt
  } = helpers;

// Faculty Attendance APIs
router.get("/", verifyToken, async (req, res) => {
  try {
    const {
      date,
      from,
      to,
      facultyId
    } = req.query || {};
    const filter = {};
    if (date) filter.date = date;
    if (from && to) filter.date = {
      gte: from,
      lte: to
    };
    const list = await prisma.facultyAttendance.findMany({
      where: filter
    }).catch(() => []);
    const narrowed = facultyId ? list.map(d => ({
      ...d,
      records: Array.isArray(d.records) ? d.records.filter(r => String(r.facultyId) === String(facultyId)) : []
    })) : list;
    return res.json(narrowed);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.post("/", verifyToken, requireRole('admin|faculty'), async (req, res) => {
  try {
    const {
      date,
      records
    } = req.body || {};
    if (!date || !Array.isArray(records) || records.length === 0) return res.status(400).json({
      message: 'date and records required'
    });
    let doc = await prisma.facultyAttendance.findFirst({
      where: {
        date
      }
    }).catch(() => null);
    if (!doc) doc = await FacultyAttendance.create({
      date,
      records: [],
      createdBy: req.user.sub
    });
    for (const rec of records) {
      const idx = Array.isArray(doc.records) ? doc.records.findIndex(r => String(r.facultyId) === String(rec.facultyId)) : -1;
      const payload = {
        facultyId: rec.facultyId,
        status: rec.status || 'present',
        markedBy: req.user.sub
      };
      if (idx >= 0) doc.records[idx] = payload;else doc.records.push(payload);
    }
    // Transpiled save()
    if (doc && doc.id) {
      const { id: _id_unused, ..._updateData } = doc;
      await prisma.facultyAttendance.update({
        where: { id: String(doc.id) },
        data: _updateData
      });
    } else if (doc && doc._id) {
      const { _id: _id_unused2, ..._updateData2 } = doc;
      await prisma.facultyAttendance.update({
        where: { id: String(doc._id) },
        data: _updateData2
      });
    }
    return res.json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

// CSV export for faculty attendance

  return router;
};
