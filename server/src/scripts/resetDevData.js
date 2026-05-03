const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');
const Todo = require('../models/Todo');
const Category = require('../models/Category');
const Completion = require('../models/Completion');
const { generateId } = require('../utils/idGenerator');

async function ensureInbox(userId) {
  return Category.findOneAndUpdate(
    {
      userId,
      systemKey: 'inbox',
      deletedAt: null,
    },
    {
      $set: {
        userId,
        name: 'Inbox',
        color: '#CCCCCC',
        order: 0,
        systemKey: 'inbox',
        deletedAt: null,
      },
      $setOnInsert: {
        _id: generateId(),
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
}

async function resetDevData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const users = await User.find({}, { _id: 1 }).lean();
    console.log(`Users: ${users.length}`);

    const [todoResult, completionResult, categoryResult] = await Promise.all([
      Todo.deleteMany({}),
      Completion.deleteMany({}),
      Category.deleteMany({}),
    ]);

    console.log(`Deleted todos: ${todoResult.deletedCount}`);
    console.log(`Deleted completions: ${completionResult.deletedCount}`);
    console.log(`Deleted categories: ${categoryResult.deletedCount}`);

    for (const user of users) {
      await ensureInbox(user._id);
    }

    console.log(`Recreated Inbox categories: ${users.length}`);
    await mongoose.disconnect();
    console.log('Done');
    process.exit(0);
  } catch (error) {
    console.error('resetDevData failed:', error);
    try {
      await mongoose.disconnect();
    } catch (_) {
      // ignore disconnect errors on failure path
    }
    process.exit(1);
  }
}

resetDevData();
