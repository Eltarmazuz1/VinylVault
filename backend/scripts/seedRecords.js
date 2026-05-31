require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const docClient = DynamoDBDocumentClient.from(client);

const records = [
  { title: 'Kind of Blue', artist: 'Miles Davis', genre: 'Jazz', year: 1959, price: 24.99, description: 'The best-selling jazz album of all time, featuring modal improvisation at its finest.', tracklist: ['So What', 'Freddie Freeloader', 'Blue in Green', 'All Blues', 'Flamenco Sketches'], avgRating: 4.9, ratingCount: 0 },
  { title: 'Abbey Road', artist: 'The Beatles', genre: 'Rock', year: 1969, price: 22.99, description: 'The last recorded album by The Beatles, featuring the legendary medley.', tracklist: ['Come Together', 'Something', 'Maxwell\'s Silver Hammer', 'Here Comes the Sun', 'Because'], avgRating: 4.8, ratingCount: 0 },
  { title: 'Thriller', artist: 'Michael Jackson', genre: 'Pop', year: 1982, price: 19.99, description: 'The best-selling album of all time with iconic tracks across pop, R&B, and rock.', tracklist: ['Wanna Be Startin\' Somethin\'', 'Beat It', 'Billie Jean', 'Thriller', 'Human Nature'], avgRating: 4.7, ratingCount: 0 },
  { title: 'The Dark Side of the Moon', artist: 'Pink Floyd', genre: 'Progressive Rock', year: 1973, price: 26.99, description: 'A concept album exploring themes of conflict, greed, time, and mental illness.', tracklist: ['Speak to Me', 'Breathe', 'Time', 'Money', 'Us and Them', 'Brain Damage', 'Eclipse'], avgRating: 4.9, ratingCount: 0 },
  { title: 'Blue', artist: 'Joni Mitchell', genre: 'Folk', year: 1971, price: 21.99, description: 'A deeply personal album widely considered one of the greatest records ever made.', tracklist: ['All I Want', 'My Old Man', 'Little Green', 'Carey', 'Blue', 'River', 'A Case of You'], avgRating: 4.8, ratingCount: 0 },
  { title: 'Nevermind', artist: 'Nirvana', genre: 'Rock', year: 1991, price: 18.99, description: 'The album that brought grunge to mainstream audiences, featuring Smells Like Teen Spirit.', tracklist: ['Smells Like Teen Spirit', 'In Bloom', 'Come as You Are', 'Lithium', 'Polly', 'Territorial Pissings'], avgRating: 4.7, ratingCount: 0 },
  { title: 'Random Access Memories', artist: 'Daft Punk', genre: 'Electronic', year: 2013, price: 29.99, description: 'A love letter to the human touch in music, blending disco, funk, and electronic elements.', tracklist: ['Give Life Back to Music', 'Get Lucky', 'Instant Crush', 'Lose Yourself to Dance', 'Within', 'Fragments of Time', 'Doin\' it Right'], avgRating: 4.6, ratingCount: 0 },
  { title: 'What\'s Going On', artist: 'Marvin Gaye', genre: 'Soul', year: 1971, price: 20.99, description: 'A landmark concept album addressing social issues through smooth, layered soul music.', tracklist: ['What\'s Going On', 'What\'s Happening Brother', 'Mercy Mercy Me', 'Inner City Blues', 'Save the Children'], avgRating: 4.9, ratingCount: 0 },
  { title: 'OK Computer', artist: 'Radiohead', genre: 'Alternative', year: 1997, price: 23.99, description: 'A prescient album about alienation in the digital age, widely regarded as a masterpiece.', tracklist: ['Airbag', 'Paranoid Android', 'Subterranean Homesick Alien', 'Exit Music', 'Let Down', 'Karma Police', 'No Surprises'], avgRating: 4.8, ratingCount: 0 },
  { title: 'To Pimp a Butterfly', artist: 'Kendrick Lamar', genre: 'Hip-Hop', year: 2015, price: 24.99, description: 'A politically charged jazz-rap masterpiece exploring race, identity, and power in America.', tracklist: ['Wesley\'s Theory', 'For Free?', 'King Kunta', 'Alright', 'These Walls', 'u', 'How Much a Dollar Cost', 'The Blacker the Berry'], avgRating: 4.9, ratingCount: 0 },
  { title: 'Rumours', artist: 'Fleetwood Mac', genre: 'Rock', year: 1977, price: 21.99, description: 'Recorded during the band\'s personal crises, resulting in some of the most emotionally raw rock songs ever.', tracklist: ['Second Hand News', 'Dreams', 'Never Going Back Again', 'The Chain', 'You Make Loving Fun', 'Go Your Own Way'], avgRating: 4.8, ratingCount: 0 },
  { title: 'Grace', artist: 'Jeff Buckley', genre: 'Alternative', year: 1994, price: 22.99, description: 'A singular debut album showcasing Buckley\'s otherworldly vocal range and emotional depth.', tracklist: ['Mojo Pin', 'Grace', 'Last Goodbye', 'Lilac Wine', 'Hallelujah', 'Lover, You Should\'ve Come Over'], avgRating: 4.7, ratingCount: 0 },
  { title: 'Cross Road Blues', artist: 'Robert Johnson', genre: 'Blues', year: 1936, price: 16.99, description: 'The mythical Delta blues recordings that influenced generations of rock and blues musicians.', tracklist: ['Cross Road Blues', 'Terraplane Blues', 'Sweet Home Chicago', 'Love in Vain'], avgRating: 4.6, ratingCount: 0 },
  { title: 'Music From Big Pink', artist: 'The Band', genre: 'Folk Rock', year: 1968, price: 19.99, description: 'A rootsy debut that helped define Americana and influenced countless artists including Eric Clapton.', tracklist: ['Tears of Rage', 'To Kingdom Come', 'In a Station', 'The Weight', 'I Shall Be Released'], avgRating: 4.5, ratingCount: 0 },
  { title: 'Discovery', artist: 'Daft Punk', genre: 'Electronic', year: 2001, price: 22.99, description: 'A sample-heavy tribute to disco and soul that defined the French house sound.', tracklist: ['One More Time', 'Aerodynamic', 'Digital Love', 'Harder Better Faster Stronger', 'Something About Us', 'Voyager'], avgRating: 4.7, ratingCount: 0 },
];

async function seed() {
  for (const r of records) {
    const item = { ...r, recordId: uuidv4(), imageUrl: null, createdAt: new Date().toISOString() };
    await docClient.send(new PutCommand({ TableName: 'vv_records', Item: item }));
    console.log(`✓ Seeded: ${item.title} — ${item.artist}`);
  }
  console.log('Seed complete.');
}

seed().catch(console.error);
