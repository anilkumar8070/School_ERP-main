const mongoose = require('mongoose')

const ImageSchema = new mongoose.Schema({
  filename: { type: String },
  originalname: { type: String },
  url: { type: String }
}, { _id: false })

const GallerySchema = new mongoose.Schema({
  label: { type: String, required: true },
  images: { type: [ImageSchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

module.exports = mongoose.model('Gallery', GallerySchema)
