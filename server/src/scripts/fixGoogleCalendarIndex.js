/**
 * Fix googleCalendarEventId index to be sparse
 * 
 * Problem: Existing index doesn't have sparse: true, causing duplicate key errors for null values
 * Solution: Drop and recreate the index with sparse: true
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function fixIndex() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const Todo = mongoose.connection.collection('todos');

    // 1. Check existing indexes
    console.log('\n📋 Current indexes:');
    const indexes = await Todo.indexes();
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx.key), idx.sparse ? '(sparse)' : '');
    });

    // 2. Drop the problematic index if it exists
    try {
      console.log('\n🗑️  Dropping googleCalendarEventId_1 index...');
      await Todo.dropIndex('googleCalendarEventId_1');
      console.log('✅ Index dropped successfully');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️  Index does not exist, skipping drop');
      } else {
        throw error;
      }
    }

    // 3. Create new sparse index
    console.log('\n🔨 Creating new sparse index...');
    await Todo.createIndex(
      { googleCalendarEventId: 1 },
      { 
        unique: true, 
        sparse: true,
        name: 'googleCalendarEventId_1'
      }
    );
    console.log('✅ Sparse index created successfully');

    // 4. Verify new indexes
    console.log('\n📋 Updated indexes:');
    const newIndexes = await Todo.indexes();
    newIndexes.forEach(idx => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx.key), idx.sparse ? '(sparse)' : '');
    });

    console.log('\n✅ Index fix completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing index:', error);
    process.exit(1);
  }
}

fixIndex();
