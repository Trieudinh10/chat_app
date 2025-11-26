const db = require('./db');

async function saveMessage(user, message) {
  const sql = 'INSERT INTO messages (username, message) VALUES (?, ?)';
  await db.execute(sql, [user, message]);
}

async function getMessages() {
  const [rows] = await db.execute('SELECT * FROM messages ORDER BY id ASC');
  return rows;
}

module.exports = { saveMessage, getMessages };
