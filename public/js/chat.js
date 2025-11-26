document.addEventListener('DOMContentLoaded', () => {
  const socket = io(window.location.origin);

  const messagesEl = document.getElementById('messages');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  let myUsername = '';

  function formatTime(date){
    const h = date.getHours().toString().padStart(2,'0');
    const m = date.getMinutes().toString().padStart(2,'0');
    return `${h}:${m}`;
  }

  function addMessage(msg, username){
    const li = document.createElement('li');
    const self = username === myUsername;
    li.className = self ? 'self' : 'other';

    li.innerHTML = `
      <div class="msg-header">
        <span class="username">${username}</span>
        <span class="time">${formatTime(new Date())}</span>
      </div>
      <div class="msg-body">${msg}</div>
    `;

    messagesEl.appendChild(li);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function sendMessage(){
    const msg = messageInput.value.trim();
    if(msg === '') return;
    if(socket.connected){
      socket.emit('chat message', msg);
      addMessage(msg, myUsername);
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
        window.location.href = '/login.html';
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
        window.location.href = '/login.html';
      } else {
        myUsername = res.user.username;
      }
    } catch(err){
      console.error(err);
      window.location.href = '/login.html';
    }
  }

  async function loadMessages(){
    try{
      const messages = await apiRequest('/api/chat/messages');
      messages.forEach(m => addMessage(m.message, m.username));
    } catch(err){
      console.error(err);
    }
  }

  socket.on('chat message', (msg)=>{
    const splitIndex = msg.indexOf(':');
    if(splitIndex === -1) return;
    const username = msg.substring(0,splitIndex).trim();
    const text = msg.substring(splitIndex+1).trim();
    if(username !== myUsername){
      addMessage(text, username);
    }
  });

  (async function init(){
    await checkLogin();
    await loadMessages();
  })();
});
