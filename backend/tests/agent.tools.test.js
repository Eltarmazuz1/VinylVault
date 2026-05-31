/**
 * Eval-style tests for the AI agent tools.
 * These verify the tool contracts (inputs → correct DynamoDB calls + output shape)
 * independently of the LLM, so the test suite doesn't make real API calls.
 */

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = jest.fn();
  return {
    DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
    ScanCommand: jest.fn((p) => ({ type: 'Scan', ...p })),
    GetCommand: jest.fn((p) => ({ type: 'Get', ...p })),
    mockSend,
  };
});
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';

const { mockSend } = require('@aws-sdk/lib-dynamodb');

// Import tools directly (bypasses LLM entirely)
const { getUserRatings, getUserPurchases, searchRecords } = require('../src/agent/tools');

const JAZZ_RECORD = {
  recordId: 'rec-jazz',
  title: 'Kind of Blue',
  artist: 'Miles Davis',
  genre: 'Jazz',
  avgRating: 4.9,
  ratingCount: 10,
  price: 24.99,
};

const ROCK_RECORD = {
  recordId: 'rec-rock',
  title: 'Nevermind',
  artist: 'Nirvana',
  genre: 'Rock',
  avgRating: 4.7,
  ratingCount: 8,
  price: 18.99,
};

describe('getUserRatings tool', () => {
  beforeEach(() => mockSend.mockReset());

  it('returns "no ratings" message when user has no history', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const result = await getUserRatings.invoke({ userId: 'new-user' });
    expect(result).toMatch(/not rated/i);
  });

  it('enriches ratings with record details', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [{ recordId: 'rec-jazz', userId: 'u1', score: 5, review: 'Perfect' }] })
      .mockResolvedValueOnce({ Item: JAZZ_RECORD });

    const result = await getUserRatings.invoke({ userId: 'u1' });
    const parsed = JSON.parse(result);
    expect(parsed[0].title).toBe('Kind of Blue');
    expect(parsed[0].score).toBe(5);
    expect(parsed[0].genre).toBe('Jazz');
  });

  it('handles missing record gracefully (record deleted after rating)', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [{ recordId: 'deleted-rec', userId: 'u1', score: 3 }] })
      .mockResolvedValueOnce({ Item: undefined });

    const result = await getUserRatings.invoke({ userId: 'u1' });
    const parsed = JSON.parse(result);
    expect(parsed[0].title).toBe('Unknown');
  });
});

describe('searchRecords tool', () => {
  beforeEach(() => mockSend.mockReset());

  it('filters by genre correctly', async () => {
    mockSend.mockResolvedValueOnce({ Items: [JAZZ_RECORD, ROCK_RECORD] });
    const result = await searchRecords.invoke({ genre: 'Jazz' });
    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].genre).toBe('Jazz');
  });

  it('filters by minimum rating', async () => {
    mockSend.mockResolvedValueOnce({ Items: [JAZZ_RECORD, ROCK_RECORD] });
    const result = await searchRecords.invoke({ minRating: 4.8 });
    const parsed = JSON.parse(result);
    expect(parsed.every((r) => r.avgRating >= 4.8)).toBe(true);
  });

  it('returns not-found message when no records match', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const result = await searchRecords.invoke({ genre: 'Polka' });
    expect(result).toMatch(/no records found/i);
  });

  it('returns only safe fields (no internal DynamoDB metadata)', async () => {
    mockSend.mockResolvedValueOnce({ Items: [JAZZ_RECORD] });
    const result = await searchRecords.invoke({});
    const parsed = JSON.parse(result);
    expect(parsed[0]).toHaveProperty('recordId');
    expect(parsed[0]).toHaveProperty('avgRating');
    expect(parsed[0]).not.toHaveProperty('createdAt'); // internal field not exposed
  });
});

describe('getUserPurchases tool', () => {
  beforeEach(() => mockSend.mockReset());

  it('returns no-purchases message for new users', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const result = await getUserPurchases.invoke({ userId: 'new' });
    expect(result).toMatch(/not purchased/i);
  });

  it('enriches purchases with record details', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [{ recordId: 'rec-jazz', purchasedAt: '2025-01-01' }] })
      .mockResolvedValueOnce({ Item: JAZZ_RECORD });

    const result = await getUserPurchases.invoke({ userId: 'u1' });
    const parsed = JSON.parse(result);
    expect(parsed[0].title).toBe('Kind of Blue');
    expect(parsed[0].purchasedAt).toBe('2025-01-01');
  });
});
