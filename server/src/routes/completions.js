const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createCompletion,
  deleteCompletion,
  getCompletions,
  toggleCompletion,
  getDeltaSync,
  createRange,
  checkCompletion,
} = require('../controllers/completionController');

// 델타 동기화 (Phase 2)
router.get('/delta-sync', auth, getDeltaSync);

// Range-Based Completion (Phase 3)
router.post('/range', auth, createRange);
router.get('/check', auth, checkCompletion);

// 완료 토글
router.post('/toggle', auth, toggleCompletion);

// CRUD
router.post('/', auth, createCompletion);
router.delete('/:todoId', auth, deleteCompletion);
router.get('/', auth, getCompletions);

module.exports = router;
