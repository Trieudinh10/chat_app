/**
 * Gửi request tới API
 * @param {string} url - URL endpoint
 * @param {string} method - GET/POST/PUT/DELETE
 * @param {object|null} data - dữ liệu gửi kèm
 * @returns {Promise<object>} - JSON response
 */
async function apiRequest(url, method = "GET", data = null) {
  const options = { method, headers: {} };
  if (data) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(data);
  }

  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API request failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Đăng nhập
 * @param {string} username 
 * @param {string} password 
 */
async function login(username, password){
  return apiRequest('/api/auth/login', 'POST', { username, password });
}

/**
 * Đăng ký
 * @param {string} username 
 * @param {string} password 
 */
async function register(username, password){
  return apiRequest('/api/auth/register', 'POST', { username, password });
}

/**
 * Logout
 */
async function logout(){
  return apiRequest('/api/auth/logout', 'POST');
}

/**
 * Kiểm tra login
 * @returns {Promise<object>} - { user: {...} } hoặc { user: null }
 */
async function checkLogin(){
  return apiRequest('/api/auth/check');
}

/**
 * Lấy lịch sử tin nhắn
 * @returns {Promise<Array>} - [{ username, message, created_at }, ...]
 */
async function getMessages(){
  return apiRequest('/api/chat/messages');
}
