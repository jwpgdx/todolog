const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  userId: {
    type: String,  // ObjectId → String
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  color: {
    type: String,
    default: '#CCCCCC'
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  },
  deletedAt: {
    type: Date,
    default: null,
  },
}, { _id: false, timestamps: true });

// 인덱스
categorySchema.index({ userId: 1, order: 1 });
categorySchema.index({ userId: 1, deletedAt: 1 });

module.exports = mongoose.model('Category', categorySchema);
