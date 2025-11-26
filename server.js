require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const cors = require('cors');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const { sessionMiddleware } = require('./utils/sessionMiddleware');
const { requireLogin } = require('./utils/authMiddleware');

const app = express();
const server = http.createServer(app);

// Socket.IO với CORS cho LAN
const io = new Server(server, {
  cors: {
    origin: '*', // Cho phép truy cập từ bất kỳ máy nào trong mạng LAN
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Root redirect
app.get('/', (req, res) => {
  if(req.session.user){
    res.redirect('/index.html');
  } else {
    res.redirect('/login.html');
  }
});

// Bảo vệ index.html
app.get('/index.html', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO dùng session
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

io.on('connection', (socket) => {
  const username = socket.request.session.user?.username || 'Anonymous';
  console.log(`User connected: ${username}`);

  // Nhận tin nhắn từ client
  socket.on('chat message', async (msg) => {
    try {
      const fullMsg = `${username}: ${msg}`;
      const { saveMessage } = require('./models/message');
      await saveMessage(username, msg);

      // Phát tin nhắn tới tất cả client
      io.emit('chat message', fullMsg);
    } catch(err){
      console.error('Error saving message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${username}`);
  });
});

// Chạy server LAN
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
