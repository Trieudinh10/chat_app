// chat.js
(async () => {
  const $ = id => document.getElementById(id);
  const authDiv = $('auth'), chatDiv = $('chat');
  const btnLogin = $('btnLogin'), btnRegister = $('btnRegister'), btnLogout = $('btnLogout');
  const usernameInput = $('username'), passwordInput = $('password'), displayInput = $('display_name');
  const authMsg = $('authMsg');

  const checkAuth = async () => {
    const r = await fetch('/api/me');
    const data = await r.json();
    if (data.user) {
      showChat(data.user);
    } else {
      showAuth();
    }
  };

  const showAuth = () => { authDiv.style.display='block'; chatDiv.style.display='none'; };
  const showChat = (user) => {
    authDiv.style.display='none'; chatDiv.style.display='block';
    initSocket(user);
  };

  btnRegister.onclick = async () => {
    const res = await fetch('/api/register', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ username: usernameInput.value, password: passwordInput.value, display_name: displayInput.value })
    });
    const data = await res.json();
    if (data.error) authMsg.innerText = data.error;
    else showChat(data.user);
  };

  btnLogin.onclick = async () => {
    const res = await fetch('/api/login', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ username: usernameInput.value, password: passwordInput.value })
    });
    const data = await res.json();
    if (data.error) authMsg.innerText = data.error;
    else showChat(data.user);
  };

  btnLogout.onclick = async () => {
    await fetch('/api/logout', { method:'POST' });
    location.reload();
  };

  // SOCKET logic
  function initSocket(user) {
    const socket = io();

    const messagesDiv = $('messages');
    const usersList = $('usersList');
    const msgInput = $('messageInput');
    const sendBtn = $('sendBtn');
    const typingDiv = $('typing');

    // load last messages
    fetch('/api/rooms/global/messages').then(r=>r.json()).then(data=>{
      messagesDiv.innerHTML = '';
      data.messages.forEach(addMessage);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });

    socket.on('connect', () => {
      console.log('socket connected');
    });

    socket.on('message', (m) => {
      addMessage(m);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });

    socket.on('user:online', (list) => {
      usersList.innerHTML = '';
      list.forEach(u => {
        const li = document.createElement('li');
        li.innerText = u.display_name || u.username;
        // click to start private (simple)
        li.style.cursor = 'pointer';
        li.onclick = () => {
          const privateTo = u;
          const text = prompt('Send private message to ' + (u.display_name || u.username));
          if (text) {
            socket.emit('message', { content: text, receiver_id: privateTo.id, room: 'global' });
          }
        };
        usersList.appendChild(li);
      });
    });

    socket.on('typing', (data) => {
      typingDiv.innerText = (data && data.user) ? `${data.user.display_name || data.user.username} is typing...` : '';
      setTimeout(()=> typingDiv.innerText = '', 1500);
    });

    sendBtn.onclick = sendMessage;
    msgInput.onkeydown = (e) => {
      if (e.key === 'Enter') { sendMessage(); return; }
      socket.emit('typing', { room: 'global' });
    };

    function sendMessage() {
      const val = msgInput.value.trim();
      if (!val) return;
      socket.emit('message', { content: val, room: 'global' });
      msgInput.value = '';
    }

    function addMessage(m) {
      const div = document.createElement('div');
      div.className = 'message' + ((m.sender && m.sender.id === user.id) ? ' me' : '');
      const who = m.sender ? (m.sender.display_name || m.sender.username) : 'Unknown';
      const time = new Date(m.created_at).toLocaleTimeString();
      if (m.receiver_id) {
        // private label
        div.innerHTML = `<strong>${who} (private)</strong> <small class="muted">${time}</small><div>${escapeHtml(m.content)}</div>`;
      } else {
        div.innerHTML = `<strong>${who}</strong> <small class="muted">${time}</small><div>${escapeHtml(m.content)}</div>`;
      }
      messagesDiv.appendChild(div);
    }

    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/[&<>"']/g, (m)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
    }
  }

  // start
  checkAuth();
})();
