/**
 * 하루종일 할일 지원을 위한 데이터베이스 마이그레이션
 * 기존 할일들을 새로운 스키마에 맞게 변환
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Todo = require('../models/Todo');

async function migrateToAllDay() {
  try {
    console.log('🚀 하루종일 할일 마이그레이션 시작...');
    
    // MongoDB 연결
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB 연결 완료');

    // 기존 할일들 조회
    const todos = await Todo.find({});
    console.log(`📋 총 ${todos.length}개의 할일을 마이그레이션합니다.`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const todo of todos) {
      try {
        // 이미 마이그레이션된 할일인지 확인
        if (todo.startDate !== undefined && todo.isAllDay !== undefined) {
          console.log(`⏭️  할일 "${todo.title}" - 이미 마이그레이션됨`);
          skippedCount++;
          continue;
        }

        // 마이그레이션 데이터 준비
        const updateData = {};

        // startDate 추출
        if (todo.startDateTime) {
          updateData.startDate = todo.startDateTime.toISOString().split('T')[0];
          updateData.isAllDay = false; // 시간이 있으면 하루종일이 아님
        } else {
          // startDateTime이 없으면 오늘 날짜로 설정하고 하루종일로 처리
          updateData.startDate = new Date().toISOString().split('T')[0];
          updateData.isAllDay = true;
        }

        // endDate 추출 (endDateTime이 있고 startDateTime과 다른 날짜인 경우)
        if (todo.endDateTime) {
          const endDateStr = todo.endDateTime.toISOString().split('T')[0];
          if (endDateStr !== updateData.startDate) {
            updateData.endDate = endDateStr;
          }
        }

        // 하루종일 할일 판단 로직
        if (todo.startDateTime) {
          const startTime = todo.startDateTime.toTimeString().slice(0, 5);
          const endTime = todo.endDateTime ? todo.endDateTime.toTimeString().slice(0, 5) : null;
          
          // 00:00으로 시작하고 시간이 명시적으로 설정되지 않은 경우 하루종일로 간주
          if (startTime === '00:00' && (!endTime || endTime === '00:00')) {
            updateData.isAllDay = true;
            updateData.startDateTime = null; // 하루종일이면 startDateTime을 null로
          }
        }

        // 업데이트 실행
        await Todo.findByIdAndUpdate(todo._id, { $set: updateData });
        
        console.log(`✅ 할일 "${todo.title}" 마이그레이션 완료:`, {
          startDate: updateData.startDate,
          endDate: updateData.endDate || 'null',
          isAllDay: updateData.isAllDay,
        });
        
        migratedCount++;
      } catch (error) {
        console.error(`❌ 할일 "${todo.title}" 마이그레이션 실패:`, error);
      }
    }

    console.log('\n🎉 마이그레이션 완료!');
    console.log(`✅ 성공: ${migratedCount}개`);
    console.log(`⏭️  스킵: ${skippedCount}개`);
    console.log(`❌ 실패: ${todos.length - migratedCount - skippedCount}개`);

  } catch (error) {
    console.error('❌ 마이그레이션 중 오류 발생:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB 연결 종료');
  }
}

// 스크립트 실행
if (require.main === module) {
  migrateToAllDay();
}

module.exports = migrateToAllDay;