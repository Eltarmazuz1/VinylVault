const express = require('express');
const { PutCommand, GetCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('../db/dynamo');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const RATINGS_TABLE = 'vv_ratings';
const RECORDS_TABLE = 'vv_records';

// POST or update a rating
router.post('/', authMiddleware, async (req, res) => {
  const { recordId, score, review } = req.body;
  const { userId } = req.user;

  if (!recordId || !score || score < 1 || score > 5) {
    return res.status(400).json({ error: 'recordId and score (1-5) are required' });
  }

  const ratingItem = {
    ratingId: `${userId}#${recordId}`,
    userId,
    recordId,
    score: Number(score),
    review: review || '',
    createdAt: new Date().toISOString(),
  };

  try {
    await docClient.send(new PutCommand({ TableName: RATINGS_TABLE, Item: ratingItem }));

    // Recalculate avg rating on the record
    const { Items } = await docClient.send(new ScanCommand({
      TableName: RATINGS_TABLE,
      FilterExpression: 'recordId = :rid',
      ExpressionAttributeValues: { ':rid': recordId },
    }));

    const count = Items.length;
    const avg = Items.reduce((sum, r) => sum + r.score, 0) / count;

    await docClient.send(new UpdateCommand({
      TableName: RECORDS_TABLE,
      Key: { recordId },
      UpdateExpression: 'SET avgRating = :avg, ratingCount = :cnt',
      ExpressionAttributeValues: { ':avg': Math.round(avg * 10) / 10, ':cnt': count },
    }));

    res.json({ ...ratingItem, avgRating: avg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ratings for a record
router.get('/record/:recordId', async (req, res) => {
  try {
    const { Items } = await docClient.send(new ScanCommand({
      TableName: RATINGS_TABLE,
      FilterExpression: 'recordId = :rid',
      ExpressionAttributeValues: { ':rid': req.params.recordId },
    }));
    res.json(Items || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ratings by a user
router.get('/user/:userId', authMiddleware, async (req, res) => {
  if (req.user.userId !== req.params.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const { Items } = await docClient.send(new ScanCommand({
      TableName: RATINGS_TABLE,
      FilterExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': req.params.userId },
    }));
    res.json(Items || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
