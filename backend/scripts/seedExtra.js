require('dotenv').config();
const https = require('https');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
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
  return new Promise((resolve) => {
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

async function getArtwork(artist, album, recordId) {
  const countries = ['us', 'gb', 'au', 'ca'];
  for (const country of countries) {
    const q = encodeURIComponent(`${artist} ${album}`);
    const data = await fetchJson(`https://itunes.apple.com/search?term=${q}&entity=album&country=${country}&limit=8`);
    if (!data?.results) continue;
    const needle = album.toLowerCase().replace(/[^a-z0-9 ]/g, '').substring(0, 14);
    const match = data.results.find(r => {
      const name = (r.collectionName || '').toLowerCase().replace(/[^a-z0-9 ]/g, '');
      return r.artistName?.toLowerCase().includes(artist.toLowerCase().split(' ')[0]) && name.includes(needle);
    });
    if (match?.artworkUrl100) {
      console.log(`  ↳ iTunes (${country.toUpperCase()})`);
      const hiRes = match.artworkUrl100.replace('100x100bb', '600x600bb');
      const buf = await fetchBuffer(hiRes);
      const key = `records/${recordId}/cover.jpg`;
      await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key, Body: buf, ContentType: 'image/jpeg' }));
      return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    }
  }
  // Deezer fallback
  const dq = encodeURIComponent(`${artist} ${album}`);
  const dz = await fetchJson(`https://api.deezer.com/search/album?q=${dq}&limit=5`);
  const dm = dz?.data?.find(r => r.artist?.name?.toLowerCase().includes(artist.toLowerCase().split(' ')[0]));
  if (dm?.cover_xl) {
    console.log(`  ↳ Deezer`);
    const buf = await fetchBuffer(dm.cover_xl);
    const key = `records/${recordId}/cover.jpg`;
    await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key, Body: buf, ContentType: 'image/jpeg' }));
    return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  }
  console.log(`  ↳ No artwork found`);
  return null;
}

const ALBUMS = [
  {
    artist: 'Taylor Swift', title: 'The Tortured Poets Department', genre: 'Pop', year: 2024, price: 26.99,
    description: 'Swift\'s 11th studio album — a raw, confessional 31-track double album (The Anthology) exploring heartbreak, obsession, and artistic identity.',
    tracklist: ['Fortnight', 'The Tortured Poets Department', 'My Boy Only Breaks His Favorite Toys', 'Down Bad', 'So Long, London', 'But Daddy I Love Him', 'Florida!!!', 'Guilty as Sin?', 'Who\'s Afraid of Little Old Me?', 'The Smallest Man Who Ever Lived', 'The Alchemy', 'Clara Bow'],
  },
  {
    artist: 'Lana Del Rey', title: 'Lust for Life', genre: 'Indie Pop', year: 2017, price: 21.99,
    description: 'Brighter and more collaborative than her earlier work — featuring The Weeknd, ASAP Rocky, Stevie Nicks, and Sean Ono Lennon.',
    tracklist: ['Love', 'Lust for Life', 'Cherry', '13 Beaches', 'White Mustang', 'Summer Bummer', 'Groupie Love', 'In My Feelings', 'Get Free'],
  },
  {
    artist: 'Lana Del Rey', title: 'Lasso', genre: 'Country Pop', year: 2024, price: 24.99,
    description: 'Lana Del Rey\'s country-influenced 2024 album, leaning into Americana and Western sounds while keeping her signature cinematic melancholy.',
    tracklist: ['Tough', 'Muscle Memory', 'Henry, Come On', 'Daddy\'s Home', 'Lost But Never Alone', 'Big Eyes', 'Pawn Shop Blues', 'Country Skies'],
  },
];

async function run() {
  const { Items: existing } = await dynamo.send(new ScanCommand({ TableName: 'vv_records', ProjectionExpression: 'title, artist' }));
  const existingKeys = new Set(existing.map(r => `${r.artist}|${r.title}`));

  for (const album of ALBUMS) {
    if (existingKeys.has(`${album.artist}|${album.title}`)) {
      console.log(`↳ skip (exists): ${album.title}`);
      continue;
    }
    const recordId = uuidv4();
    console.log(`\n→ ${album.artist} — ${album.title}`);
    const imageUrl = await getArtwork(album.artist, album.title, recordId);
    await dynamo.send(new PutCommand({
      TableName: 'vv_records',
      Item: { recordId, ...album, imageUrl, avgRating: 0, ratingCount: 0, createdAt: new Date().toISOString() },
    }));
    console.log(`  ✓ Saved`);
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('\nAll done.');
}

run().catch(console.error);
