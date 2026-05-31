const request = require('supertest');

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = jest.fn();
  return {
    DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
    ScanCommand: jest.fn((p) => ({ type: 'Scan', ...p })),
    GetCommand: jest.fn((p) => ({ type: 'Get', ...p })),
    PutCommand: jest.fn((p) => ({ type: 'Put', ...p })),
    UpdateCommand: jest.fn((p) => ({ type: 'Update', ...p })),
    mockSend,
  };
});
jest.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: jest.fn(() => ({})) }));
jest.mock('@aws-sdk/client-s3', () => ({ S3Client: jest.fn(() => ({})), PutObjectCommand: jest.fn() }));
jest.mock('../src/agent/graph', () => ({ runAgent: jest.fn() }));

process.env.JWT_SECRET = 'test_secret';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';
process.env.S3_BUCKET_NAME = 'test-bucket';

const { mockSend } = require('@aws-sdk/lib-dynamodb');
const app = require('../src/index');

const SAMPLE_RECORD = {
  recordId: 'rec-1',
  title: 'Kind of Blue',
  artist: 'Miles Davis',
  genre: 'Jazz',
  year: 1959,
  price: 24.99,
  avgRating: 4.9,
  ratingCount: 42,
};

describe('GET /api/records', () => {
  beforeEach(() => mockSend.mockReset());

  it('returns all records', async () => {
    mockSend.mockResolvedValueOnce({ Items: [SAMPLE_RECORD] });
    const res = await request(app).get('/api/records');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Kind of Blue');
  });

  it('returns empty array when no records exist', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const res = await request(app).get('/api/records');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/records/:id', () => {
  beforeEach(() => mockSend.mockReset());

  it('returns a single record by ID', async () => {
    mockSend.mockResolvedValueOnce({ Item: SAMPLE_RECORD });
    const res = await request(app).get('/api/records/rec-1');
    expect(res.status).toBe(200);
    expect(res.body.recordId).toBe('rec-1');
  });

  it('returns 404 for non-existent record', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });
    const res = await request(app).get('/api/records/does-not-exist');
    expect(res.status).toBe(404);
  });
});
