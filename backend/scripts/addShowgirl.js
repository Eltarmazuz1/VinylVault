require('dotenv').config();
const https = require('https');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY },
}));
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY },
});

function fetchJson(url) {
  return new Promise(res => https.get(url, { headers: { 'User-Agent': 'iTunes/12.0' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch { res(null); } });
  }).on('error', () => res(null)));
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : require('http');
    mod.get(url, { headers: { 'User-Agent': 'iTunes/12.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) return fetchBuffer(res.headers.location).then(resolve).catch(reject);
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function run() {
  const data = await fetchJson('https://itunes.apple.com/lookup?id=1833328839&country=us');
  const artUrl = data?.results?.[0]?.artworkUrl100?.replace('100x100bb', '600x600bb');
  console.log('Artwork URL:', artUrl?.slice(0, 60));

  const recordId = uuidv4();
  const buf = await fetchBuffer(artUrl);
  const key = `records/${recordId}/cover.jpg`;
  await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key, Body: buf, ContentType: 'image/jpeg' }));
  const imageUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

  await dynamo.send(new PutCommand({
    TableName: 'vv_records',
    Item: {
      recordId,
      title: 'The Life of a Showgirl',
      artist: 'Taylor Swift',
      genre: 'Soft Pop',
      year: 2025,
      price: 26.99,
      description: "Taylor Swift's twelfth studio album — recorded in Sweden with Max Martin and Shellback during the Eras Tour. A vibrant new wave-leaning record about fame and love, featuring Sabrina Carpenter on the title track.",
      tracklist: [
        'The Fate of Ophelia', 'Elizabeth Taylor', 'Opalite', 'Honey',
        'Father Figure', 'Cancelled!', 'Wood', 'Wish List',
        'The Life of a Showgirl (feat. Sabrina Carpenter)', 'Ruin the Friendship', 'Eldest Daughter',
      ],
      imageUrl,
      avgRating: 0,
      ratingCount: 0,
      createdAt: new Date().toISOString(),
    },
  }));
  console.log('Done! Saved to DynamoDB with image:', imageUrl.slice(0, 70));
}

run().catch(console.error);
