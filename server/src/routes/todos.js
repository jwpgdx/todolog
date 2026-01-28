const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getTodos,
  getAllTodos,
  getMonthEvents,
  getDeltaSync,
  createTodo,
  updateTodo,
  deleteTodo,
  bulkDeleteTodos,
  getCalendarSummary,
  retryCalendarSync,
  retryAllFailedSync,
} = require('../controllers/todoController');

router.get('/delta-sync', auth, getDeltaSync);
router.get('/month/:year/:month', auth, getMonthEvents);
router.get('/calendar', auth, getCalendarSummary);
router.get('/all', auth, getAllTodos);
router.get('/', auth, getTodos);
router.post('/', auth, createTodo);

router.post('/bulk-delete', auth, bulkDeleteTodos);
router.post('/retry-sync/:id', auth, retryCalendarSync);
router.post('/retry-all-sync', auth, retryAllFailedSync);
router.put('/:id', auth, updateTodo);
router.delete('/:id', auth, deleteTodo);

module.exports = router;
