require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const todoRoutes = require('./routes/todos');
const completionRoutes = require('./routes/completions');

const app = express();

connectDB();

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/completions', completionRoutes);
app.use('/api/categories', require('./routes/categories'));

app.get('/', (req, res) => {
  res.json({ message: 'Todo API Server' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
