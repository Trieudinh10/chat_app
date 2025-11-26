document.addEventListener('DOMContentLoaded', () => {
  const socket = io(window.location.origin);

  const messagesEl = document.getElementById('messages');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  let myUsername = '';
  let lastUsername = ''; // Lưu username của tin nhắn cuối cùng

  function formatTime(date){
    const h = date.getHours().toString().padStart(2,'0');
    const m = date.getMinutes().toString().padStart(2,'0');
    return `${h}:${m}`;
  }

  function addMessage(msg, username, timestamp){
    const li = document.createElement('li');
    const self = username === myUsername;
    li.className = self ? 'self' : 'other';

    // Nếu timestamp là string từ DB, chuyển thành Date object
    const msgTime = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;

    // Kiểm tra nếu username trùng với tin nhắn trước đó
    const showHeader = username !== lastUsername;
    lastUsername = username;

    if (showHeader) {
      // Hiển thị header (tên + thời gian) nếu là tin nhắn từ user mới
      li.innerHTML = `
        <div class="msg-header">
          <span class="username">${username}</span>
          <span class="time">${formatTime(msgTime)}</span>
        </div>
        <div class="msg-body">${msg}</div>
      `;
    } else {
      // Không hiển thị header nếu username trùng
      li.innerHTML = `
        <div class="msg-body">${msg}</div>
      `;
      li.classList.add('no-header');
    }

    messagesEl.appendChild(li);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function sendMessage(){
    const msg = messageInput.value.trim();
    if(msg === '') return;
    if(socket.connected){
      socket.emit('chat message', msg);
      const timestamp = new Date();
      addMessage(msg, myUsername, timestamp);
      messageInput.value = '';
    }
  }

  messageInput.addEventListener('keypress', (e)=>{
    if(e.key === 'Enter') sendMessage();
  });

  sendBtn.addEventListener('click', sendMessage);

  logoutBtn.addEventListener('click', async ()=>{
    try{
      const res = await apiRequest('/api/auth/logout','POST');
      if(res.success){
        socket.disconnect();
        window.location.href = '/login';
      } else {
        alert("Logout thất bại: " + res.error);
      }
    } catch(err){
      console.error(err);
    }
  });

  async function checkLogin(){
    try{
      const res = await apiRequest('/api/auth/check');
      if(!res.user){
        window.location.href = '/login';
      } else {
        myUsername = res.user.username;
      }
    } catch(err){
      console.error(err);
      window.location.href = '/login';
    }
  }

  async function loadMessages(){
    try{
      const messages = await apiRequest('/api/chat/messages');
      messages.forEach(m => addMessage(m.message, m.username, m.created_at || new Date()));
    } catch(err){
      console.error(err);
    }
  }

  socket.on('chat message', (msgObj)=>{
    // msgObj là object với {username, message, timestamp}
    if(msgObj.username !== myUsername){
      addMessage(msgObj.message, msgObj.username, msgObj.timestamp);
    }
  });

  (async function init(){
    await checkLogin();
    await loadMessages();
  })();
});
