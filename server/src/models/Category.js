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
  systemKey: {
    type: String,
    default: null,
    trim: true,
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
categorySchema.index(
  { userId: 1, systemKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      deletedAt: null,
      systemKey: { $ne: null },
    },
  }
);

module.exports = mongoose.model('Category', categorySchema);
