/**
 * Clear test data from MongoDB
 * 
 * Removes all todos and completions for test user to allow fresh migration
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function clearTestData() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const testEmail = 'test_1770322740793@example.com';

    // Find test user
    const User = mongoose.connection.collection('users');
    const testUser = await User.findOne({ email: testEmail });

    if (!testUser) {
      console.log('ℹ️  Test user not found');
      process.exit(0);
    }

    console.log(`\n🔍 Found test user: ${testUser._id}`);

    // Delete todos
    const Todo = mongoose.connection.collection('todos');
    const todoResult = await Todo.deleteMany({ userId: testUser._id });
    console.log(`🗑️  Deleted ${todoResult.deletedCount} todos`);

    // Delete completions
    const Completion = mongoose.connection.collection('completions');
    const compResult = await Completion.deleteMany({ userId: testUser._id });
    console.log(`🗑️  Deleted ${compResult.deletedCount} completions`);

    // Delete categories (except Inbox)
    const Category = mongoose.connection.collection('categories');
    const catResult = await Category.deleteMany({ 
      userId: testUser._id,
      name: { $ne: 'Inbox' }
    });
    console.log(`🗑️  Deleted ${catResult.deletedCount} categories (kept Inbox)`);

    console.log('\n✅ Test data cleared successfully!');
    console.log('💡 You can now retry the migration');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing test data:', error);
    process.exit(1);
  }
}

clearTestData();
