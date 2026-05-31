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

async function uploadFromUrl(imageUrl, recordId) {
  const buf = await fetchBuffer(imageUrl);
  const key = `records/${recordId}/cover.jpg`;
  await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key, Body: buf, ContentType: 'image/jpeg' }));
  return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

// Confirmed iTunes IDs (avoids wrong search results)
const FIXES = [
  {
    match: { artist: 'Lana Del Rey', title: 'Ultraviolence' },
    source: async () => {
      const d = await fetchJson('https://itunes.apple.com/lookup?id=1442879908&country=us');
      const art = d?.results?.[0]?.artworkUrl100;
      return art ? art.replace('100x100bb', '600x600bb') : null;
    },
  },
  {
    match: { artist: 'Lana Del Rey', title: 'Lust for Life' },
    source: async () => {
      // Use Deezer with the specific album title
      const d = await fetchJson('https://api.deezer.com/search/album?q=artist:"Lana Del Rey" album:"Lust for Life"&limit=10');
      const album = d?.data?.find(r => r.title?.toLowerCase().includes('lust for life') && !r.title?.toLowerCase().includes('remix') && !r.title?.toLowerCase().includes('single'));
      console.log('  Deezer results:', d?.data?.slice(0,3).map(r => r.title).join(' | '));
      return album?.cover_xl || null;
    },
  },
];

async function run() {
  const { Items } = await dynamo.send(new ScanCommand({ TableName: 'vv_records' }));

  for (const fix of FIXES) {
    const record = Items.find(r => r.artist === fix.match.artist && r.title === fix.match.title);
    if (!record) { console.log(`NOT FOUND: ${fix.match.title}`); continue; }

    console.log(`\n→ Fixing: ${record.artist} — ${record.title}`);
    const artUrl = await fix.source();
    if (!artUrl) { console.log('  ✗ No source URL found'); continue; }

    console.log('  Source URL:', artUrl.slice(0, 60));
    const s3Url = await uploadFromUrl(artUrl, record.recordId);
    await dynamo.send(new UpdateCommand({
      TableName: 'vv_records',
      Key: { recordId: record.recordId },
      UpdateExpression: 'SET imageUrl = :url',
      ExpressionAttributeValues: { ':url': s3Url },
    }));
    console.log('  ✓ Fixed');
  }
  console.log('\nDone.');
}

run().catch(console.error);
