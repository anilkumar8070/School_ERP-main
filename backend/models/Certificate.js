const mongoose = require('mongoose')

const CertificateSchema = new mongoose.Schema({
  schoolName: { type: String, default: '' },
  title: { type: String, default: '' },
  recipientId: { type: mongoose.Schema.Types.ObjectId, refPath: 'recipientType', required: false },
  recipientType: { type: String, enum: ['Student', 'Faculty', 'User', 'Other'], default: 'User' },
  recipientName: { type: String, default: '' },
  certificationFor: { type: String, default: '' },
  dateOfIssue: { type: String, default: '' },
  signaturePath: { type: String, default: '' },
  filePath: { type: String, default: '' },
  mime: { type: String, default: '' },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now }
}, { timestamps: true })

module.exports = mongoose.models.Certificate || mongoose.model('Certificate', CertificateSchema)
