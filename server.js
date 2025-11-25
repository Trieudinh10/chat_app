// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const helmet = require('helmet');
const { Server } = require('socket.io');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const bcrypt = require('bcryptjs');
const pool = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Session store config (lưu session vào MySQL)
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

const sessionMiddleware = session({
  key: 'chat_sid',
  secret: process.env.SESSION_SECRET || 'secret',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 3600 * 1000 } // 1 day
});

// middlewares
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, 'public')));

// helper: check auth
function ensureAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

// Routes: đăng ký, đăng nhập, đăng xuất, user info
app.post('/api/register', async (req, res) => {
  const { username, password, display_name } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (rows.length) return res.status(400).json({ error: 'Username exists' });
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query('INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)', [username, hash, display_name || username]);
    req.session.user = { id: result.insertId, username, display_name: display_name || username };
    return res.json({ success: true, user: req.session.user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const [rows] = await pool.query('SELECT id, password_hash, display_name FROM users WHERE username = ?', [username]);
    if (!rows.length) return res.status(400).json({ error: 'Invalid credentials' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    req.session.user = { id: user.id, username, display_name: user.display_name || username };
    return res.json({ success: true, user: req.session.user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/logout', ensureAuth, (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.json({ user: null });
  return res.json({ user: req.session.user });
});

// get last N messages of a room
app.get('/api/rooms/:room/messages', ensureAuth, async (req, res) => {
  const room = req.params.room || 'global';
  try {
    const [msgs] = await pool.query(
      `SELECT m.id, m.content, m.created_at, m.room, m.receiver_id,
              u.id as sender_id, u.username, u.display_name
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.room = ?
       ORDER BY m.created_at ASC
       LIMIT 100`, [room]
    );

    const formatted = msgs.map(m => ({
  id: m.id,
  content: m.content,
  room: m.room,
  receiver_id: m.receiver_id,
  created_at: m.created_at,
  sender: {
    id: m.sender_id,
    username: m.username,
    display_name: m.display_name
  }
}));


res.json({ messages: formatted });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ---- SOCKET.IO ---- */
// Integrate session with socket.io
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

const onlineUsers = new Map(); // socket.id -> user

io.on('connection', (socket) => {
  const req = socket.request;
  const user = req.session && req.session.user;
  if (!user) {
    // not authenticated: disconnect
    socket.emit('unauthorized');
    socket.disconnect();
    return;
  }

  // mark online
  onlineUsers.set(socket.id, user);

  // notify all: user connected
  io.emit('user:online', Array.from(new Set(Array.from(onlineUsers.values()).map(u => ({ id: u.id, username: u.username, display_name: u.display_name })))));

  // join default room
  const room = 'global';
  socket.join(room);

  socket.on('message', async (payload) => {
    // payload: { content, room?, receiver_id? }
    try {
      const content = String(payload.content || '').trim();
      if (!content) return;
      const r = payload.room || 'global';
      const receiver_id = payload.receiver_id || null;
      // save to DB
      const [result] = await pool.query('INSERT INTO messages (sender_id, receiver_id, room, content) VALUES (?, ?, ?, ?)', [user.id, receiver_id, r, content]);
      const message = {
        id: result.insertId,
        content,
        room: r,
        receiver_id,
        created_at: new Date(),
        sender: { id: user.id, username: user.username, display_name: user.display_name }
      };
      if (receiver_id) {
        // private: emit to sender and to receiver sockets
        // find sockets of receiver
        for (const [sid, u] of onlineUsers.entries()) {
          if (u.id === receiver_id) {
            io.to(sid).emit('message', message);
          }
        }
        socket.emit('message', message);
      } else {
        // public to room
        io.to(r).emit('message', message);
      }
    } catch (err) {
      console.error('save message error', err);
    }
  });

  socket.on('typing', (data) => {
    // data: { room }
    socket.to(data.room || 'global').emit('typing', { user: { id: user.id, username: user.username, display_name: user.display_name }});
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    io.emit('user:online', Array.from(new Set(Array.from(onlineUsers.values()).map(u => ({ id: u.id, username: u.username, display_name: u.display_name })))));
  });
});


const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Server listening on port ${port}`));