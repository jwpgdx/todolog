const Category = require('../models/Category');
const Todo = require('../models/Todo');
const Completion = require('../models/Completion');
const { generateId, isValidUUID } = require('../utils/idGenerator');

// Get all categories for a user
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ userId: req.userId, deletedAt: null }).sort({ order: 1, createdAt: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new category
exports.createCategory = async (req, res) => {
  try {
    const { _id, name, color } = req.body;

    if (Object.prototype.hasOwnProperty.call(req.body, 'systemKey')) {
      return res.status(400).json({ message: 'systemKey는 설정할 수 없습니다.' });
    }

    // 클라이언트 _id 수용 또는 서버에서 생성
    const categoryId = _id || generateId();

    // UUID 검증 (클라이언트 제공 시)
    if (_id && !isValidUUID(_id)) {
      return res.status(400).json({ message: 'Invalid UUID format' });
    }

    const category = new Category({
      _id: categoryId,
      userId: req.userId,
      name,
      color
    });
    const newCategory = await category.save();
    res.status(201).json(newCategory);
  } catch (error) {
    // 중복 ID 처리
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Category already exists' });
    }
    res.status(400).json({ message: error.message });
  }
};

// Update a category
exports.updateCategory = async (req, res) => {
  try {
    const { name, color } = req.body;
    const category = await Category.findOne({ _id: req.params.id, userId: req.userId });

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'systemKey')) {
      return res.status(400).json({ message: 'systemKey는 변경할 수 없습니다.' });
    }

    const isInbox = category.systemKey === 'inbox';
    if (isInbox) {
      const attempted = [];
      if (Object.prototype.hasOwnProperty.call(req.body, 'name')) attempted.push('name');
      if (Object.prototype.hasOwnProperty.call(req.body, 'color')) attempted.push('color');
      if (Object.prototype.hasOwnProperty.call(req.body, 'order')) attempted.push('order');
      if (Object.prototype.hasOwnProperty.call(req.body, 'icon')) attempted.push('icon');
      if (attempted.length > 0) {
        return res.status(400).json({ message: `Inbox 카테고리는 변경할 수 없습니다. (${attempted.join(', ')})` });
      }
    }

    if (name) category.name = name;
    if (color) category.color = color;
    if (req.body.order !== undefined) category.order = req.body.order;

    const updatedCategory = await category.save();
    res.json(updatedCategory);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete a category
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findOne({ _id: req.params.id, userId: req.userId });

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    if (category.systemKey === 'inbox') {
      return res.status(400).json({ message: 'Inbox 카테고리는 삭제할 수 없습니다.' });
    }

    const activeCategoryCount = await Category.countDocuments({
      userId: req.userId,
      deletedAt: null,
    });
    if (activeCategoryCount <= 1) {
      return res.status(400).json({ message: '마지막 카테고리는 삭제할 수 없습니다.' });
    }

    const now = new Date();
    const isCategoryAlreadyDeleted = Boolean(category.deletedAt);

    // Cascade tombstone 대상 Todo 조회
    const activeTodos = await Todo.find({
      userId: req.userId,
      categoryId: category._id,
      deletedAt: null,
    }).select('_id');
    const todoIds = activeTodos.map(t => t._id);

    // Category tombstone (이미 tombstone인 경우 idempotent 유지)
    if (!isCategoryAlreadyDeleted) {
      category.deletedAt = now;
      category.updatedAt = now;
      await category.save();
    }

    // Todo tombstone cascade
    const todoTombstoneResult = await Todo.updateMany(
      {
        userId: req.userId,
        categoryId: category._id,
        deletedAt: null,
      },
      {
        deletedAt: now,
        updatedAt: now,
      }
    );

    // Completion tombstone cascade
    let completionTombstoneCount = 0;
    if (todoIds.length > 0) {
      const completionTombstoneResult = await Completion.updateMany(
        {
          userId: req.userId,
          todoId: { $in: todoIds },
          deletedAt: null,
        },
        {
          deletedAt: now,
          updatedAt: now,
        }
      );
      completionTombstoneCount = completionTombstoneResult.modifiedCount || 0;
    }

    // Idempotent delete 응답 (이미 삭제된 카테고리 재호출)
    if (isCategoryAlreadyDeleted) {
      return res.status(200).json({
        message: 'Category already deleted',
        idempotent: true,
        alreadyDeleted: true,
        tombstonedTodoCount: todoTombstoneResult.modifiedCount || 0,
        tombstonedCompletionCount: completionTombstoneCount,
      });
    }

    res.json({
      message: 'Category deleted with tombstone cascade',
      tombstonedTodoCount: todoTombstoneResult.modifiedCount || 0,
      tombstonedCompletionCount: completionTombstoneCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
