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

// Set up EJS view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
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
    res.redirect('/chat');
  } else {
    res.redirect('/login');
  }
});



// Chat page (protected)
app.get('/chat', requireLogin, (req, res) => {
  res.render('index');
});

// Login page
app.get('/login', (req, res) => {
  if(req.session.user){
    res.redirect('/chat');
  } else {
    res.render('login');
  }
});

// Register page
app.get('/register', (req, res) => {
  if(req.session.user){
    res.redirect('/chat');
  } else {
    res.render('register');
  }
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
      const { saveMessage } = require('./models/message');
      await saveMessage(username, msg);

      // Phật tin nhắn tới tất cả client (kèm theo thời gian)
      const timestamp = new Date();
      io.emit('chat message', {
        username: username,
        message: msg,
        timestamp: timestamp
      });
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
