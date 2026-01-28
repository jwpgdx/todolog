const mongoose = require('mongoose');

const completionSchema = new mongoose.Schema({
  todoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Todo',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: String, // "2024-11-24" format (기간 할일은 null)
  },
  completedAt: {
    type: Date,
    default: Date.now,
  },
});

// 같은 날짜에 같은 할일 중복 완료 방지
// date=null(기간 할일)는 todoId만으로 unique, 다른 타입은 todoId+date로 unique
completionSchema.index({ todoId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Completion', completionSchema);
