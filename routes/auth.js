const express = require('express');
const router = express.Router();
const db = require('../models/db');
const bcrypt = require('bcrypt');

// Register
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  try {
    await db.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashed]);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const [rows] = await db.execute('SELECT * FROM users WHERE username=?', [username]);
  if (rows.length === 0) return res.json({ success: false, error: 'User not found' });

  const user = rows[0];
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.json({ success: false, error: 'Incorrect password' });

  req.session.user = { id: user.id, username: user.username };
  res.json({ success: true, user: req.session.user });
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.json({ success: false, error: err.message });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// Check session
router.get('/check', (req, res) => {
  if(req.session.user){
    res.json({ user: req.session.user });
  } else {
    res.json({ user: null });
  }
});

module.exports = router;
