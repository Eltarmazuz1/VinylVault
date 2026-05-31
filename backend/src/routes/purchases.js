const express = require('express');
const { PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('../db/dynamo');
const authMiddleware = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const TABLE = 'vv_purchases';

// POST purchase a record
router.post('/', authMiddleware, async (req, res) => {
  const { recordId, price } = req.body;
  const { userId } = req.user;

  if (!recordId || price == null) {
    return res.status(400).json({ error: 'recordId and price are required' });
  }

  const purchase = {
    purchaseId: uuidv4(),
    userId,
    recordId,
    price: Number(price),
    purchasedAt: new Date().toISOString(),
  };

  try {
    await docClient.send(new PutCommand({ TableName: TABLE, Item: purchase }));
    res.status(201).json(purchase);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET purchases for the logged-in user
router.get('/me', authMiddleware, async (req, res) => {
  const { userId } = req.user;
  try {
    const { Items } = await docClient.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
    }));
    res.json(Items || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
