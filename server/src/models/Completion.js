const mongoose = require('mongoose');

const completionSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
  },
  todoId: {
    type: String,
    ref: 'Todo',
    required: true,
    index: true,
  },
  userId: {
    type: String,
    ref: 'User',
    required: true,
    index: true,
  },
  date: {
    type: String,  // YYYY-MM-DD or null
  },
  completedAt: {
    type: Date,
    required: true,
  },
}, { _id: false, timestamps: true });

// 복합 인덱스: 사용자별 날짜 조회
completionSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('Completion', completionSchema);
