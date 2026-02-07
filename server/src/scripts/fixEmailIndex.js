require('dotenv').config();
const mongoose = require('mongoose');

async function fixEmailIndex() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // 1. 기존 email 인덱스 확인
    const indexes = await usersCollection.indexes();
    console.log('Current indexes:', JSON.stringify(indexes, null, 2));

    // 2. email_1 인덱스 삭제
    try {
      await usersCollection.dropIndex('email_1');
      console.log('✅ Dropped email_1 index');
    } catch (error) {
      console.log('⚠️ email_1 index not found or already dropped');
    }

    // 3. 새로운 partial index 생성 (null이 아닌 경우만 unique)
    await usersCollection.createIndex(
      { email: 1 },
      { 
        unique: true,
        partialFilterExpression: { email: { $type: 'string' } }
      }
    );
    console.log('✅ Created new email index with partial filter');

    // 4. 최종 인덱스 확인
    const newIndexes = await usersCollection.indexes();
    console.log('New indexes:', JSON.stringify(newIndexes, null, 2));

    console.log('\n✅ Email index migration completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

fixEmailIndex();
