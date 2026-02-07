const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createCompletion,
  deleteCompletion,
  getCompletions,
  getAllCompletions,
  toggleCompletion,
  getDeltaSync,
  createRange,
  checkCompletion,
} = require('../controllers/completionController');

// Full Sync (모든 완료 기록 조회)
router.get('/all', auth, getAllCompletions);

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
