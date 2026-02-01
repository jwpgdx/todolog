/**
 * Completion 모델 마이그레이션 스크립트 (Phase 3)
 * Range-Based Completion 필드 추가
 * 
 * 실행 방법:
 * node server/src/scripts/migrateCompletionsPhase3.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Completion = require('../models/Completion');

async function migratePhase3() {
  try {
    console.log('🔄 Completion Phase 3 마이그레이션 시작...');
    
    // MongoDB 연결
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB 연결 성공');

    // 기존 Completion 조회 (isRange 필드 없는 것만)
    const completions = await Completion.find({ 
      isRange: { $exists: false } 
    });

    console.log(`📊 마이그레이션 대상: ${completions.length}개`);

    if (completions.length === 0) {
      console.log('✨ 마이그레이션할 데이터가 없습니다.');
      
      // 인덱스만 업데이트
      await updateIndexes();
      process.exit(0);
    }

    let successCount = 0;
    let failCount = 0;

    // 각 Completion에 Range 필드 추가
    for (const completion of completions) {
      try {
        // isRange: false로 초기화 (기존 데이터는 단일 날짜)
        completion.isRange = false;
        
        // startDate, endDate는 null로 초기화
        completion.startDate = undefined;
        completion.endDate = undefined;

        await completion.save();
        successCount++;

        if (successCount % 100 === 0) {
          console.log(`⏳ 진행 중: ${successCount}/${completions.length}`);
        }
      } catch (error) {
        console.error(`❌ 마이그레이션 실패 (ID: ${completion._id}):`, error.message);
        failCount++;
      }
    }

    console.log('\n✅ 데이터 마이그레이션 완료!');
    console.log(`   성공: ${successCount}개`);
    console.log(`   실패: ${failCount}개`);

    // 인덱스 업데이트
    await updateIndexes();

    console.log('\n🎉 Phase 3 마이그레이션 완료!');
    process.exit(0);
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
    process.exit(1);
  }
}

async function updateIndexes() {
  console.log('\n🔄 인덱스 업데이트 중...');
  
  try {
    // 기존 Partial Index 삭제
    try {
      await Completion.collection.dropIndex('todoId_1_date_1');
      console.log('✅ 기존 Partial Index 삭제 완료');
    } catch (error) {
      console.log('⚠️ 기존 Partial Index 없음 (정상)');
    }

    // 새 Partial Index 생성 (isRange: false 조건 추가)
    await Completion.collection.createIndex(
      { todoId: 1, date: 1 },
      { 
        unique: true, 
        partialFilterExpression: { deletedAt: null, isRange: false } 
      }
    );
    console.log('✅ 새 Partial Index 생성 완료 (isRange: false 조건 추가)');

    // Range 조회용 인덱스 생성
    await Completion.collection.createIndex({ 
      todoId: 1, 
      startDate: 1, 
      endDate: 1 
    });
    console.log('✅ Range 조회 인덱스 생성 완료');

    console.log('✅ 모든 인덱스 업데이트 완료');
  } catch (error) {
    console.error('❌ 인덱스 업데이트 실패:', error);
    throw error;
  }
}

// 실행
migratePhase3();
