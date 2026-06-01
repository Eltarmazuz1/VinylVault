const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('../db/dynamo');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const TABLE = 'vv_users';

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password, and name are required' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const userId = uuidv4();

  try {
    await docClient.send(new PutCommand({
      TableName: TABLE,
      Item: { userId, email, password: hashed, name, createdAt: new Date().toISOString() },
      ConditionExpression: 'attribute_not_exists(email)',
    }));
    const token = jwt.sign({ userId, email, name }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { userId, email, name } });
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  try {
    const { Item } = await docClient.send(new GetCommand({
      TableName: TABLE,
      Key: { userId: email }, // secondary lookup handled via scan below
    }));

    // Users table uses userId as PK; login needs email lookup via GSI or scan
    // We use a GSI on email — fall back to a simple approach here
    const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: 'email = :e',
      ExpressionAttributeValues: { ':e': email },
    }));

    const user = result.Items?.[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user.userId, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { userId: user.userId, email: user.email, name: user.name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
