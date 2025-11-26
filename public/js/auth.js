document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const res = await apiRequest('/api/auth/login', 'POST', { username, password });
      if (res.success) location.href = '/index.html';
      else alert(res.error);
    });
  }

  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async e => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const res = await apiRequest('/api/auth/register', 'POST', { username, password });
      if (res.success) location.href = '/login.html';
      else alert(res.error);
    });
  }
});

async function logout() {
  const res = await apiRequest('/api/auth/logout', 'POST');
  if(res.success){
    // ngắt Socket.IO
    if(typeof socket !== 'undefined') socket.disconnect();
    // chuyển về trang login
    window.location.href = '/login.html';
  } else {
    alert("Logout failed: " + res.error);
  }
}


