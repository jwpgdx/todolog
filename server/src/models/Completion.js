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
  // 단일 날짜 완료 (일반 할일, 기간 할일)
  date: {
    type: String, // "2024-11-24" format (기간 할일은 null)
  },
  // Phase 3: Range-Based Completion (반복일정 연속 완료용)
  startDate: {
    type: String, // "2024-11-24" format
  },
  endDate: {
    type: String, // "2024-11-30" format
  },
  isRange: {
    type: Boolean,
    default: false,
  },
  completedAt: {
    type: Date,
    default: Date.now,
  },
  // Phase 2: 델타 동기화 지원
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
});

// Partial Index: deletedAt이 null인 경우에만 unique 제약
// Soft Delete 후 재완료 시 Unique 제약 위반 방지
completionSchema.index(
  { todoId: 1, date: 1 },
  { 
    unique: true, 
    partialFilterExpression: { deletedAt: null, isRange: false } 
  }
);

// Range 조회용 인덱스
completionSchema.index({ todoId: 1, startDate: 1, endDate: 1 });

// 델타 동기화용 인덱스
completionSchema.index({ userId: 1, updatedAt: 1 });
completionSchema.index({ userId: 1, deletedAt: 1 });

// updatedAt 자동 업데이트
completionSchema.pre('save', function() {
  this.updatedAt = new Date();
});

/**
 * 특정 날짜가 완료되었는지 확인 (Range 포함)
 * @param {ObjectId} todoId - Todo ID
 * @param {ObjectId} userId - User ID
 * @param {string} targetDate - "YYYY-MM-DD"
 * @returns {Promise<boolean>}
 */
completionSchema.statics.isCompletedOnDate = async function(todoId, userId, targetDate) {
  const completion = await this.findOne({
    todoId,
    userId,
    deletedAt: null,
    $or: [
      { date: targetDate }, // 정확한 날짜 매칭
      { // Range 내 포함
        isRange: true,
        startDate: { $lte: targetDate },
        endDate: { $gte: targetDate },
      },
    ],
  });
  
  return !!completion;
};

module.exports = mongoose.model('Completion', completionSchema);
