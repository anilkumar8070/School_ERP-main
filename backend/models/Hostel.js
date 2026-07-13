const mongoose = require('mongoose')

const BedSchema = new mongoose.Schema({
  occupiedBy: { type: mongoose.Schema.Types.Mixed, default: null }
}, { _id: false })

const RoomSchema = new mongoose.Schema({
  number: { type: Number, required: true },
  beds: { type: [BedSchema], default: [] }
}, { _id: false })

const FloorSchema = new mongoose.Schema({
  number: { type: Number, required: true },
  rooms: { type: [RoomSchema], default: [] }
}, { _id: false })

const HostelSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  floors: { type: [FloorSchema], default: [] },
  address: { type: String, default: '' },
  capacity: { type: Number, default: 0 },
  amenities: { type: [String], default: [] },
  warden: { type: String, default: '' },
  contact: { type: String, default: '' }
}, { timestamps: true })

module.exports = mongoose.model('Hostel', HostelSchema)
