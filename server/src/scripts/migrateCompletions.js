/**
 * Completion 모델 마이그레이션 스크립트
 * Phase 2: updatedAt, deletedAt 필드 추가
 * 
 * 실행 방법:
 * node server/src/scripts/migrateCompletions.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Completion = require('../models/Completion');

async function migrateCompletions() {
  try {
    console.log('🔄 Completion 마이그레이션 시작...');
    
    // MongoDB 연결
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB 연결 성공');

    // 기존 Completion 조회 (updatedAt 없는 것만)
    const completions = await Completion.find({ 
      updatedAt: { $exists: false } 
    });

    console.log(`📊 마이그레이션 대상: ${completions.length}개`);

    if (completions.length === 0) {
      console.log('✨ 마이그레이션할 데이터가 없습니다.');
      process.exit(0);
    }

    let successCount = 0;
    let failCount = 0;

    // 각 Completion에 updatedAt, deletedAt 추가
    for (const completion of completions) {
      try {
        // updatedAt: completedAt과 동일하게 설정
        completion.updatedAt = completion.completedAt || new Date();
        
        // deletedAt: null로 초기화
        completion.deletedAt = null;

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

    console.log('\n✅ 마이그레이션 완료!');
    console.log(`   성공: ${successCount}개`);
    console.log(`   실패: ${failCount}개`);

    // 인덱스 재생성 (Partial Index 적용)
    console.log('\n🔄 인덱스 재생성 중...');
    
    // 기존 인덱스 삭제
    try {
      await Completion.collection.dropIndex('todoId_1_date_1');
      console.log('✅ 기존 인덱스 삭제 완료');
    } catch (error) {
      console.log('⚠️ 기존 인덱스 없음 (정상)');
    }

    // 새 인덱스 생성 (Partial Index)
    await Completion.collection.createIndex(
      { todoId: 1, date: 1 },
      { 
        unique: true, 
        partialFilterExpression: { deletedAt: null } 
      }
    );
    console.log('✅ Partial Index 생성 완료');

    // 델타 동기화용 인덱스 생성
    await Completion.collection.createIndex({ userId: 1, updatedAt: 1 });
    await Completion.collection.createIndex({ userId: 1, deletedAt: 1 });
    console.log('✅ 델타 동기화 인덱스 생성 완료');

    console.log('\n🎉 모든 마이그레이션 완료!');
    process.exit(0);
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
    process.exit(1);
  }
}

// 실행
migrateCompletions();
