const express = require('express');
const { PutCommand, GetCommand, ScanCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { docClient } = require('../db/dynamo');
const { s3 } = require('../s3/s3Client');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const TABLE = 'vv_records';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET all records (with optional genre/artist filter)
router.get('/', async (req, res) => {
  const { genre, artist, search } = req.query;
  try {
    // Fetch all records then filter in JS — DynamoDB contains() is case-sensitive and has no lower()
    let { Items } = await docClient.send(new ScanCommand({ TableName: TABLE }));
    let results = Items || [];

    if (genre) {
      results = results.filter(r => r.genre?.toLowerCase().includes(genre.toLowerCase()));
    }
    if (artist) {
      const a = artist.toLowerCase();
      results = results.filter(r => r.artist?.toLowerCase().includes(a));
    }
    if (search) {
      const s = search.toLowerCase();
      results = results.filter(r =>
        r.title?.toLowerCase().includes(s) || r.artist?.toLowerCase().includes(s)
      );
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single record
router.get('/:recordId', async (req, res) => {
  try {
    const { Item } = await docClient.send(new GetCommand({
      TableName: TABLE,
      Key: { recordId: req.params.recordId },
    }));
    if (!Item) return res.status(404).json({ error: 'Record not found' });
    res.json(Item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create record (admin use / seeding)
router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
  const { title, artist, genre, year, price, description, tracklist } = req.body;
  if (!title || !artist || !genre || !price) {
    return res.status(400).json({ error: 'title, artist, genre, and price are required' });
  }

  const recordId = uuidv4();
  let imageUrl = null;

  if (req.file) {
    const key = `records/${recordId}/${req.file.originalname}`;
    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));
    imageUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  }

  const item = {
    recordId,
    title,
    artist,
    genre,
    year: year ? Number(year) : null,
    price: Number(price),
    description: description || '',
    tracklist: tracklist ? JSON.parse(tracklist) : [],
    imageUrl,
    avgRating: 0,
    ratingCount: 0,
    createdAt: new Date().toISOString(),
  };

  try {
    await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
