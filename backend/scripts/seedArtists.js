require('dotenv').config();
const https = require('https');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
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
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'VinylVault/1.0' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const get = (u, redirects = 0) => {
      const mod = u.startsWith('https') ? https : require('http');
      mod.get(u, { headers: { 'User-Agent': 'VinylVault/1.0' } }, res => {
        if ((res.statusCode === 301 || res.statusCode === 302) && redirects < 5) {
          return get(res.headers.location, redirects + 1);
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    };
    get(url);
  });
}

async function uploadImageToS3(imageUrl, recordId) {
  try {
    // iTunes gives 100x100, bump to 600x600
    const hiResUrl = imageUrl.replace('100x100', '600x600');
    const buf = await fetchBuffer(hiResUrl);
    const key = `records/${recordId}/cover.jpg`;
    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: buf,
      ContentType: 'image/jpeg',
    }));
    return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  } catch (e) {
    console.warn(`  ⚠ image upload failed: ${e.message}`);
    return null;
  }
}

async function searchiTunes(artist, album) {
  const q = encodeURIComponent(`${artist} ${album}`);
  const data = await fetchJson(`https://itunes.apple.com/search?term=${q}&entity=album&limit=5`);
  const needle = album.toLowerCase().split('(')[0].trim().replace(/[^a-z0-9 ]/g, '');
  const match = data.results?.find(r => {
    const name = (r.collectionName || '').toLowerCase().replace(/[^a-z0-9 ]/g, '');
    return r.artistName?.toLowerCase().includes(artist.toLowerCase()) && name.includes(needle.substring(0, 12));
  });
  return match;
}

const ALBUMS = [
  // Taylor Swift
  { artist: 'Taylor Swift', title: 'Taylor Swift', genre: 'Pop/Country', year: 2006, price: 18.99, description: 'Taylor Swift\'s self-titled debut album, blending country and pop with confessional songwriting that launched her career.', tracklist: ['Tim McGraw', 'Picture to Burn', 'Teardrops on My Guitar', 'A Place in This World', 'Cold as You', 'Our Song', 'Should\'ve Said No'] },
  { artist: 'Taylor Swift', title: 'Fearless', genre: 'Pop/Country', year: 2008, price: 19.99, description: 'The Grammy Album of the Year winner that made Swift a global star, filled with anthemic country-pop storytelling.', tracklist: ['Love Story', 'You Belong With Me', 'Fearless', 'Fifteen', 'White Horse', 'You\'re Not Sorry', 'Forever & Always'] },
  { artist: 'Taylor Swift', title: 'Speak Now', genre: 'Pop/Country', year: 2010, price: 19.99, description: 'Entirely self-written album showcasing Swift\'s growth as a songwriter with rich narrative ballads and rockers.', tracklist: ['Mine', 'Sparks Fly', 'Back to December', 'Speak Now', 'Dear John', 'Mean', 'The Story of Us', 'Enchanted'] },
  { artist: 'Taylor Swift', title: 'Red', genre: 'Pop', year: 2012, price: 21.99, description: 'A genre-blending masterpiece mixing country heartbreak with pop, rock, and dubstep — featuring the 10-minute All Too Well.', tracklist: ['State of Grace', 'Red', 'Treacherous', '22', 'I Knew You Were Trouble', 'All Too Well', 'We Are Never Ever Getting Back Together'] },
  { artist: 'Taylor Swift', title: '1989', genre: 'Pop', year: 2014, price: 21.99, description: 'Swift\'s full pop pivot and Grammy Award winner — a synth-pop masterwork of polished hooks and personal reinvention.', tracklist: ['Welcome to New York', 'Blank Space', 'Style', 'Bad Blood', 'Shake It Off', 'Out of the Woods', 'Clean'] },
  { artist: 'Taylor Swift', title: 'Reputation', genre: 'Pop', year: 2017, price: 21.99, description: 'Dark, defiant, and sonically bold — Swift leans into electronic pop and hip-hop influences to reclaim her narrative.', tracklist: ['...Ready for It?', 'End Game', 'I Did Something Bad', 'Delicate', 'Look What You Made Me Do', 'Getaway Car', 'New Year\'s Day'] },
  { artist: 'Taylor Swift', title: 'Lover', genre: 'Pop', year: 2019, price: 22.99, description: 'A bright, romantic, and maximalist pop album celebrating love in all its forms.', tracklist: ['I Forgot That You Existed', 'Cruel Summer', 'Lover', 'The Man', 'The Archer', 'Paper Rings', 'Death By A Thousand Cuts', 'London Boy'] },
  { artist: 'Taylor Swift', title: 'Folklore', genre: 'Indie Folk', year: 2020, price: 23.99, description: 'Swift\'s acclaimed indie-folk surprise album, a quiet and cinematic collection of fictional vignettes produced with Aaron Dessner.', tracklist: ['the 1', 'cardigan', 'the last great american dynasty', 'exile', 'my tears ricochet', 'mirrorball', 'august', 'this is me trying', 'betty'] },
  { artist: 'Taylor Swift', title: 'Evermore', genre: 'Indie Folk', year: 2020, price: 23.99, description: 'Folklore\'s sister album — warmer, more autumnal, and featuring HAIM, Bon Iver, and The National.', tracklist: ['willow', 'champagne problems', 'gold rush', 'tolerate it', 'happiness', 'cowboy like me', 'long story short', 'ivy', 'closure', 'evermore'] },
  { artist: 'Taylor Swift', title: 'Midnights', genre: 'Synth-Pop', year: 2022, price: 24.99, description: 'A late-night synth-pop concept album exploring 13 sleepless nights of self-reflection, featuring Anti-Hero.', tracklist: ['Lavender Haze', 'Marjorie', 'Anti-Hero', 'Snow on the Beach', 'Midnight Rain', 'Question...?', 'Vigilante Shit', 'Karma'] },

  // Lana Del Rey
  { artist: 'Lana Del Rey', title: 'Born to Die', genre: 'Indie Pop', year: 2012, price: 20.99, description: 'Lana\'s cinematic major-label debut, weaving baroque pop, hip-hop beats, and Hollywood tragedy into a signature sound.', tracklist: ['Born to Die', 'Off to the Races', 'Blue Jeans', 'Video Games', 'Diet Mountain Dew', 'National Anthem', 'Summertime Sadness'] },
  { artist: 'Lana Del Rey', title: 'Ultraviolence', genre: 'Dream Pop', year: 2014, price: 21.99, description: 'Darker, guitar-driven, and produced by Dan Auerbach — a hypnotic slow-burn of noir romance.', tracklist: ['Cruel World', 'Ultraviolence', 'Shades of Cool', 'Brooklyn Baby', 'West Coast', 'Sad Girl', 'Pretty When You Cry', 'Money Power Glory'] },
  { artist: 'Lana Del Rey', title: 'Honeymoon', genre: 'Dream Pop', year: 2015, price: 21.99, description: 'Lush, orchestral, and languid — a romantic slow-drip of velvet pop that leans fully into Lana\'s cinematic vision.', tracklist: ['Honeymoon', 'Music to Watch Boys To', 'Terrence Loves You', 'God Knows I Tried', 'Salvatore', 'Art Deco', 'Burnt Norton'] },
  { artist: 'Lana Del Rey', title: 'Norman Fucking Rockwell!', genre: 'Indie Folk', year: 2019, price: 23.99, description: 'Widely considered her masterpiece — a warm, expansive meditation on California, love, and American mythology. Produced by Jack Antonoff.', tracklist: ['Norman Fucking Rockwell', 'Mariners Apartment Complex', 'Venice Bitch', 'Fuck It I Love You', 'Doin\' Time', 'The Greatest', 'Hope Is a Dangerous Thing'] },
  { artist: 'Lana Del Rey', title: 'Chemtrails over the Country Club', genre: 'Indie Folk', year: 2021, price: 22.99, description: 'Quieter and more intimate than NFR — a tender exploration of suburban life and belonging featuring Joni Mitchell covers.', tracklist: ['White Dress', 'Chemtrails over the Country Club', 'Tulsa Jesus Freak', 'Let Me Love You Like a Woman', 'Wild at Heart', 'Dark But Just a Game', 'For Free'] },
  { artist: 'Lana Del Rey', title: 'Blue Banisters', genre: 'Indie Folk', year: 2021, price: 22.99, description: 'A raw, personal album with minimal production — some tracks home-recorded, capturing Lana at her most unguarded.', tracklist: ['Text Book', 'Blue Banisters', 'Arcadia', 'Interlude - The Trio', 'Black Bathing Suit', 'If You Lie Down With Me', 'Beautiful'] },
  { artist: 'Lana Del Rey', title: 'Did You Know That There\'s a Tunnel Under Ocean Blvd', genre: 'Art Pop', year: 2023, price: 24.99, description: 'A maximalist, sprawling 78-minute meditation on mortality, legacy, and family — her most ambitious work yet.', tracklist: ['The Grants', 'Did You Know That There\'s a Tunnel Under Ocean Blvd', 'Sweet', 'A&W', 'Judah Smith Interlude', 'Candy Necklace', 'Margaret', 'Fishtail'] },
];

async function seed() {
  // Get existing record titles to avoid duplicates
  const { Items: existing } = await dynamo.send(new ScanCommand({ TableName: 'vv_records', ProjectionExpression: 'title, artist' }));
  const existingKeys = new Set(existing.map(r => `${r.artist}|${r.title}`));

  for (const album of ALBUMS) {
    const key = `${album.artist}|${album.title}`;
    if (existingKeys.has(key)) {
      console.log(`↳ skip (exists): ${album.title}`);
      continue;
    }

    const recordId = uuidv4();
    console.log(`\n→ Seeding: ${album.artist} — ${album.title}`);

    // Fetch artwork from iTunes and upload to S3
    let imageUrl = null;
    const iTunesMatch = await searchiTunes(album.artist, album.title).catch(() => null);
    if (iTunesMatch?.artworkUrl100) {
      console.log(`  ↳ Found artwork on iTunes, uploading to S3...`);
      imageUrl = await uploadImageToS3(iTunesMatch.artworkUrl100, recordId);
      if (imageUrl) console.log(`  ✓ Image uploaded`);
    } else {
      console.log(`  ⚠ No iTunes match found`);
    }

    await dynamo.send(new PutCommand({
      TableName: 'vv_records',
      Item: {
        recordId,
        title: album.title,
        artist: album.artist,
        genre: album.genre,
        year: album.year,
        price: album.price,
        description: album.description,
        tracklist: album.tracklist,
        imageUrl,
        avgRating: 0,
        ratingCount: 0,
        createdAt: new Date().toISOString(),
      },
    }));
    console.log(`  ✓ Saved to DynamoDB`);

    // Small delay to avoid iTunes rate limiting
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('\nDone!');
}

seed().catch(console.error);
