const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createCompletion,
  deleteCompletion,
  getCompletions,
  toggleCompletion,
} = require('../controllers/completionController');

router.post('/toggle', auth, toggleCompletion);
router.post('/', auth, createCompletion);
router.delete('/:todoId', auth, deleteCompletion);
router.get('/', auth, getCompletions);

module.exports = router;
