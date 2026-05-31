const express = require('express');
const authMiddleware = require('../middleware/auth');
const { runAgent } = require('../agent/graph');

const router = express.Router();

router.post('/chat', authMiddleware, async (req, res) => {
  const { message, threadId } = req.body;
  const { userId } = req.user;

  if (!message) return res.status(400).json({ error: 'message is required' });

  try {
    const reply = await runAgent(userId, message, threadId || userId);
    res.json({ reply });
  } catch (err) {
    console.error('Agent error:', err);
    res.status(500).json({ error: 'Agent failed to respond' });
  }
});

module.exports = router;
