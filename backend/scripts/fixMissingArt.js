require('dotenv').config();
const https = require('https');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY },
}));
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY },
});

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'iTunes/12.0 (Macintosh)' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    }).on('error', () => resolve(null));
  });
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : require('http');
    mod.get(url, { headers: { 'User-Agent': 'iTunes/12.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) return fetchBuffer(res.headers.location).then(resolve).catch(reject);
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function searchITunes(artist, album) {
  const countries = ['us', 'gb', 'au', 'ca'];
  for (const country of countries) {
    const q = encodeURIComponent(`${artist} ${album}`);
    const data = await fetchJson(`https://itunes.apple.com/search?term=${q}&entity=album&country=${country}&limit=8`);
    if (!data?.results) continue;
    const needle = album.toLowerCase().replace(/[^a-z0-9 ]/g, '').substring(0, 15);
    const match = data.results.find(r => {
      const name = (r.collectionName || '').toLowerCase().replace(/[^a-z0-9 ]/g, '');
      return r.artistName?.toLowerCase().includes(artist.toLowerCase().split(' ')[0]) && name.includes(needle);
    });
    if (match?.artworkUrl100) {
      console.log(`  ↳ Found via iTunes ${country.toUpperCase()}`);
      return match.artworkUrl100;
    }
  }
  return null;
}

async function searchDeezer(artist, album) {
  const q = encodeURIComponent(`artist:"${artist}" album:"${album}"`);
  const data = await fetchJson(`https://api.deezer.com/search/album?q=${q}&limit=5`);
  const match = data?.data?.[0];
  if (match?.cover_xl) {
    console.log(`  ↳ Found via Deezer`);
    return match.cover_xl;
  }
  return null;
}

async function uploadToS3(imageUrl, recordId) {
  const hiRes = imageUrl.replace('100x100', '600x600').replace('bb.jpg', 'bb.jpg');
  const buf = await fetchBuffer(hiRes);
  const key = `records/${recordId}/cover.jpg`;
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: buf,
    ContentType: 'image/jpeg',
  }));
  return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

async function run() {
  const { Items } = await dynamo.send(new ScanCommand({ TableName: 'vv_records' }));
  const missing = Items.filter(r => !r.imageUrl);
  console.log(`Found ${missing.length} records without artwork.\n`);

  for (const record of missing) {
    console.log(`→ ${record.artist} — ${record.title}`);
    let artUrl = await searchITunes(record.artist, record.title);
    if (!artUrl) artUrl = await searchDeezer(record.artist, record.title);

    if (!artUrl) {
      console.log(`  ✗ No artwork found\n`);
      continue;
    }

    try {
      const s3Url = await uploadToS3(artUrl, record.recordId);
      await dynamo.send(new UpdateCommand({
        TableName: 'vv_records',
        Key: { recordId: record.recordId },
        UpdateExpression: 'SET imageUrl = :url',
        ExpressionAttributeValues: { ':url': s3Url },
      }));
      console.log(`  ✓ Fixed\n`);
    } catch (e) {
      console.log(`  ✗ Upload failed: ${e.message}\n`);
    }
    await new Promise(r => setTimeout(r, 400));
  }
  console.log('Done.');
}

run().catch(console.error);
