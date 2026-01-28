const mongoose = require('mongoose');
const { routineToRRule } = require('../utils/recurrenceUtils');
require('dotenv').config();

// 기존 스키마 (마이그레이션용)
const OldTodoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  startTime: { type: String },
  endTime: { type: String },
  memo: { type: String },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  type: { type: String, enum: ['todo', 'routine'], required: true, default: 'todo' },
  date: { type: String },
  endDate: { type: String },
  routine: {
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'] },
    weekdays: [Number],
    dayOfMonth: Number,
    month: Number,
    day: Number,
    startDate: String,
    endDate: String,
  },
  order: {
    keep: { type: Number },
    category: { type: Number }
  },
  googleCalendarEventId: { type: String },
  syncStatus: { type: String, enum: ['synced', 'pending', 'failed'], default: null },
  lastSyncAttempt: { type: Date },
}, { timestamps: true });

const OldTodo = mongoose.model('OldTodo', OldTodoSchema, 'todos');

// 새 스키마
const NewTodo = require('../models/Todo');

async function migrateToRecurrence() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB 연결 성공');
    
    const oldTodos = await OldTodo.find({});
    console.log(`마이그레이션할 할일 개수: ${oldTodos.length}`);
    
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const oldTodo of oldTodos) {
      try {
        const newTodoData = await convertTodoToNewSchema(oldTodo);
        
        // 기존 문서 업데이트 (upsert)
        await NewTodo.findByIdAndUpdate(
          oldTodo._id,
          newTodoData,
          { upsert: true, new: true }
        );
        
        migratedCount++;
        
        if (migratedCount % 100 === 0) {
          console.log(`진행률: ${migratedCount}/${oldTodos.length}`);
        }
      } catch (error) {
        console.error(`할일 마이그레이션 실패 (ID: ${oldTodo._id}):`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n=== 마이그레이션 완료 ===');
    console.log(`성공: ${migratedCount}개`);
    console.log(`실패: ${errorCount}개`);
    
    // 마이그레이션 검증
    await validateMigration();
    
  } catch (error) {
    console.error('마이그레이션 오류:', error);
  } finally {
    await mongoose.disconnect();
  }
}

async function convertTodoToNewSchema(oldTodo) {
  const newData = {
    userId: oldTodo.userId,
    title: oldTodo.title,
    memo: oldTodo.memo,
    categoryId: oldTodo.categoryId,
    order: oldTodo.order,
    googleCalendarEventId: oldTodo.googleCalendarEventId,
    syncStatus: oldTodo.syncStatus,
    lastSyncAttempt: oldTodo.lastSyncAttempt,
    createdAt: oldTodo.createdAt,
    updatedAt: oldTodo.updatedAt,
  };
  
  // 시작 일시 계산
  if (oldTodo.type === 'todo') {
    // 특정 날짜 할일
    const dateStr = oldTodo.date || new Date().toISOString().split('T')[0];
    const timeStr = oldTodo.startTime || '09:00';
    newData.startDateTime = new Date(`${dateStr}T${timeStr}:00`);
    
    // 종료 일시 계산
    if (oldTodo.endDate) {
      const endTimeStr = oldTodo.endTime || oldTodo.startTime || '09:00';
      newData.endDateTime = new Date(`${oldTodo.endDate}T${endTimeStr}:00`);
    } else if (oldTodo.endTime) {
      const endTimeStr = oldTodo.endTime;
      newData.endDateTime = new Date(`${dateStr}T${endTimeStr}:00`);
    }
    
    // 단발성 할일이므로 recurrence는 null
    newData.recurrence = null;
    
  } else if (oldTodo.type === 'routine') {
    // 루틴 할일
    const startDateStr = oldTodo.routine?.startDate || new Date().toISOString().split('T')[0];
    const timeStr = oldTodo.startTime || '09:00';
    newData.startDateTime = new Date(`${startDateStr}T${timeStr}:00`);
    
    // 종료 일시 (루틴의 경우 시작일의 종료 시간)
    if (oldTodo.endTime) {
      newData.endDateTime = new Date(`${startDateStr}T${oldTodo.endTime}:00`);
    }
    
    // RRULE 변환
    if (oldTodo.routine) {
      newData.recurrence = routineToRRule(oldTodo.routine, newData.startDateTime);
      
      // 반복 종료일
      if (oldTodo.routine.endDate) {
        newData.recurrenceEndDate = new Date(`${oldTodo.routine.endDate}T23:59:59`);
      }
    }
  }
  
  return newData;
}

async function validateMigration() {
  console.log('\n=== 마이그레이션 검증 ===');
  
  const oldCount = await OldTodo.countDocuments({});
  const newCount = await NewTodo.countDocuments({});
  
  console.log(`기존 할일 수: ${oldCount}`);
  console.log(`새 할일 수: ${newCount}`);
  
  if (oldCount === newCount) {
    console.log('✅ 개수 일치');
  } else {
    console.log('❌ 개수 불일치');
  }
  
  // 샘플 검증
  const sampleOld = await OldTodo.findOne({ type: 'routine' });
  if (sampleOld) {
    const sampleNew = await NewTodo.findById(sampleOld._id);
    console.log('\n--- 샘플 비교 ---');
    console.log('기존:', {
      title: sampleOld.title,
      type: sampleOld.type,
      routine: sampleOld.routine
    });
    console.log('새로운:', {
      title: sampleNew.title,
      startDateTime: sampleNew.startDateTime,
      recurrence: sampleNew.recurrence
    });
  }
}

// 스크립트 실행
if (require.main === module) {
  migrateToRecurrence();
}

module.exports = { migrateToRecurrence };