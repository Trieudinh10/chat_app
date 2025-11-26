const express = require('express');
const router = express.Router();
const { getMessages } = require('../models/message');

router.get('/messages', async (req, res) => {
  const messages = await getMessages();
  res.json(messages);
});

module.exports = router;
