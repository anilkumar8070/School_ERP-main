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

// Create gallery item (admin only)

// List gallery items (public)

// Delete a gallery item (admin)
router.post("/", verifyToken, requireRole('admin'), upload.array('images', 100), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const label = req.body && req.body.label ? String(req.body.label) : '';
    if (!label) return res.status(400).json({
      message: 'label required'
    });
    const files = req.files || [];
    const images = (files || []).map(f => ({
      filename: f.filename,
      originalname: f.originalname,
      url: `/uploads/${f.filename}`
    }));
    const doc = await Gallery.create({
      data: {
        label,
        images,
        createdBy: req.user && req.user.sub
      }
    });
    return res.status(201).json(doc);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.get("/", async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const items = await prisma.gallery.findMany({
      orderBy: {
        createdAt: "desc"
      }
    }).catch(() => []);
    const mapped = (items || []).map(it => ({
      ...it,
      images: (it.images || []).map(img => ({
        ...img,
        url: img.url || `/uploads/${img.filename}`
      }))
    }));
    return res.json(mapped);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.delete("/:id", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const id = req.params && req.params.id;
    if (!id) return res.status(400).json({
      message: 'id required'
    });
    const g = await prisma.gallery.findUnique({
      where: {
        id: String(id)
      }
    }).catch(() => null);
    if (!g) return res.status(404).json({
      message: 'Gallery item not found'
    });
    // attempt to unlink files
    try {
      for (const im of g.images || []) {
        if (im && im.filename) {
          const p = path.join(uploadsDir, String(im.filename));
          fs.unlinkSync(p);
        }
      }
    } catch (e) {
      console.warn('Failed to unlink gallery files', e && e.message);
    }
    await Gallery.deleteMany({ where: {
      id: id
    } }).catch(() => null);
    return res.json({
      ok: true
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
// Add images to an existing gallery

// Remove a single image from a gallery by filename (admin)
router.post("/:id/images", verifyToken, requireRole('admin'), upload.array('images', 100), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const id = req.params && req.params.id;
    if (!id) return res.status(400).json({
      message: 'id required'
    });
    const gallery = await prisma.gallery.findUnique({
      where: {
        id: String(id)
      }
    }).catch(() => null);
    if (!gallery) return res.status(404).json({
      message: 'Gallery not found'
    });
    const files = req.files || [];
    const images = (files || []).map(f => ({
      filename: f.filename,
      originalname: f.originalname,
      url: `/uploads/${f.filename}`
    }));
    gallery.images = gallery.images || [];
    gallery.images.push(...images);
    // Transpiled save()
    if (gallery) {
      const { id: _unused_id, _id: _unused__id, save: _unused_save, toObject: _unused_toObject, ..._updateData } = gallery;
      
      // Clean out relational arrays if any to prevent Prisma crash
      for (const k in _updateData) {
        if (Array.isArray(_updateData[k]) && _updateData[k].length > 0 && typeof _updateData[k][0] === 'object') {
           delete _updateData[k];
        }
      }

      await prisma.gallery.update({
        where: { id: String((gallery.id || gallery._id)) },
        data: _updateData
      }).catch(e => console.error("Transpiled save error:", e.message));
    }
    return res.json(gallery);
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});
router.delete("/:id/images", verifyToken, requireRole('admin'), async (req, res) => {
  if (false) return res.status(503).json({
    message: 'Database not available'
  });
  try {
    const id = req.params && req.params.id;
    const filename = req.query && req.query.filename;
    if (!id || !filename) return res.status(400).json({
      message: 'id and filename required'
    });
    const gallery = await prisma.gallery.findUnique({
      where: {
        id: String(id)
      }
    }).catch(() => null);
    if (!gallery) return res.status(404).json({
      message: 'Gallery not found'
    });
    let idx = (gallery.images || []).findIndex(im => String(im.filename) === String(filename) || String(im.url || '').endsWith(String(filename)));
    if (idx === -1) {
      // fallback: try substring match (looser) and url-decoded filename
      const decoded = (() => {
        try {
          return decodeURIComponent(filename);
        } catch (e) {
          return filename;
        }
      })();
      idx = (gallery.images || []).findIndex(im => im.filename && String(im.filename).includes(filename) || im.url && String(im.url).includes(filename) || im.filename && String(im.filename).includes(decoded) || im.url && String(im.url).includes(decoded));
    }
    if (idx === -1) return res.status(404).json({
      message: 'Image not found in gallery'
    });
    const im = gallery.images[idx];
    gallery.images.splice(idx, 1);
    // Transpiled save()
    if (gallery) {
      const { id: _unused_id, _id: _unused__id, save: _unused_save, toObject: _unused_toObject, ..._updateData } = gallery;
      
      // Clean out relational arrays if any to prevent Prisma crash
      for (const k in _updateData) {
        if (Array.isArray(_updateData[k]) && _updateData[k].length > 0 && typeof _updateData[k][0] === 'object') {
           delete _updateData[k];
        }
      }

      await prisma.gallery.update({
        where: { id: String((gallery.id || gallery._id)) },
        data: _updateData
      }).catch(e => console.error("Transpiled save error:", e.message));
    }
    // unlink file if exists
    try {
      if (im && im.filename) {
        const p = path.join(uploadsDir, String(im.filename));
        fs.unlinkSync(p);
      }
    } catch (e) {
      console.warn('Failed to unlink gallery image', e && e.message);
    }
    return res.json({
      ok: true
    });
  } catch (e) {
    return res.status(500).json({
      message: e.message
    });
  }
});

  return router;
};
