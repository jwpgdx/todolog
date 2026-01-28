const mongoose = require('mongoose');
require('dotenv').config();

const Todo = require('../models/Todo');

async function cleanupOldFields() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB 연결 성공');
    
    // 불필요한 필드들 제거
    const result = await Todo.updateMany(
      {},
      {
        $unset: {
          type: "",           // type 필드 제거
          date: "",           // date 필드 제거  
          endDate: "",        // endDate 필드 제거
          routine: "",        // routine 객체 제거
          startTime: "",      // startTime 필드 제거
          endTime: "",        // endTime 필드 제거
          priority: "",       // priority 필드 제거 (사용하지 않음)
        }
      }
    );
    
    console.log(`✅ ${result.modifiedCount}개 문서에서 불필요한 필드 제거 완료`);
    
    // 정리 후 샘플 데이터 확인
    const sampleTodos = await Todo.find({}).limit(3);
    console.log('\n=== 정리 후 데이터 확인 ===');
    sampleTodos.forEach((todo, index) => {
      console.log(`${index + 1}. ${todo.title}`);
      console.log('   startDateTime:', todo.startDateTime);
      console.log('   endDateTime:', todo.endDateTime);
      console.log('   recurrence:', todo.recurrence);
      console.log('   categoryId:', todo.categoryId);
      console.log('');
    });
    
    console.log('🎉 데이터베이스 정리 완료!');
    
  } catch (error) {
    console.error('❌ 정리 중 오류 발생:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// 스크립트 실행
if (require.main === module) {
  cleanupOldFields();
}

module.exports = { cleanupOldFields };