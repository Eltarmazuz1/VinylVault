const request = require('supertest');

// Mock AWS SDK before requiring app
jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = jest.fn();
  return {
    DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
    PutCommand: jest.fn((params) => ({ type: 'Put', params })),
    GetCommand: jest.fn((params) => ({ type: 'Get', params })),
    ScanCommand: jest.fn((params) => ({ type: 'Scan', params })),
    UpdateCommand: jest.fn((params) => ({ type: 'Update', params })),
    mockSend,
  };
});

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));
jest.mock('../src/agent/graph', () => ({ runAgent: jest.fn() }));

const { mockSend } = require('@aws-sdk/lib-dynamodb');

process.env.JWT_SECRET = 'test_secret';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';

const app = require('../src/index');
const jwt = require('jsonwebtoken');

const testUser = { userId: 'user-123', email: 'test@test.com', name: 'Test' };
const token = jwt.sign(testUser, 'test_secret');

describe('POST /api/ratings', () => {
  beforeEach(() => mockSend.mockReset());

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).post('/api/ratings').send({ recordId: 'rec-1', score: 4 });
    expect(res.status).toBe(401);
  });

  it('validates score range', async () => {
    const res = await request(app)
      .post('/api/ratings')
      .set('Authorization', `Bearer ${token}`)
      .send({ recordId: 'rec-1', score: 6 });
    expect(res.status).toBe(400);
  });

  it('saves a valid rating and updates record avg', async () => {
    // First call: PutCommand (save rating)
    // Second call: ScanCommand (get all ratings for record)
    // Third call: UpdateCommand (update record avg)
    mockSend
      .mockResolvedValueOnce({}) // Put rating
      .mockResolvedValueOnce({  // Scan ratings
        Items: [
          { ratingId: 'user-123#rec-1', userId: 'user-123', recordId: 'rec-1', score: 4 },
          { ratingId: 'user-456#rec-1', userId: 'user-456', recordId: 'rec-1', score: 2 },
        ],
      })
      .mockResolvedValueOnce({}); // Update record

    const res = await request(app)
      .post('/api/ratings')
      .set('Authorization', `Bearer ${token}`)
      .send({ recordId: 'rec-1', score: 4, review: 'Great record!' });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(4);
    expect(res.body.avgRating).toBe(3); // (4+2)/2
  });

  it('allows updating an existing rating (idempotent PUT)', async () => {
    mockSend
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Items: [{ userId: 'user-123', recordId: 'rec-1', score: 5 }] })
      .mockResolvedValueOnce({});

    const res = await request(app)
      .post('/api/ratings')
      .set('Authorization', `Bearer ${token}`)
      .send({ recordId: 'rec-1', score: 5 });

    expect(res.status).toBe(200);
    expect(res.body.avgRating).toBe(5);
  });
});

describe('GET /api/ratings/record/:recordId', () => {
  beforeEach(() => mockSend.mockReset());

  it('returns ratings for a record (no auth required)', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [{ ratingId: 'u1#r1', userId: 'u1', recordId: 'r1', score: 5 }],
    });
    const res = await request(app).get('/api/ratings/record/r1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('returns empty array for unrated record', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const res = await request(app).get('/api/ratings/record/unknown');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
