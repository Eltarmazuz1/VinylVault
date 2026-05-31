const { tool } = require('@langchain/core/tools');
const { ScanCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('../db/dynamo');
const { z } = require('zod');

const getUserRatings = tool(
  async ({ userId }) => {
    const { Items } = await docClient.send(new ScanCommand({
      TableName: 'vv_ratings',
      FilterExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
    }));

    if (!Items || Items.length === 0) return 'This user has not rated any records yet.';

    // Enrich with record details
    const enriched = await Promise.all(Items.map(async (r) => {
      const { Item } = await docClient.send(new GetCommand({
        TableName: 'vv_records',
        Key: { recordId: r.recordId },
      }));
      return {
        title: Item?.title || 'Unknown',
        artist: Item?.artist || 'Unknown',
        genre: Item?.genre || 'Unknown',
        score: r.score,
        review: r.review,
      };
    }));

    return JSON.stringify(enriched);
  },
  {
    name: 'get_user_ratings',
    description: 'Fetches all music records this user has rated, including title, artist, genre, and their score (1–5).',
    schema: z.object({ userId: z.string().describe('The user ID to fetch ratings for') }),
  }
);

const getUserPurchases = tool(
  async ({ userId }) => {
    const { Items } = await docClient.send(new ScanCommand({
      TableName: 'vv_purchases',
      FilterExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
    }));

    if (!Items || Items.length === 0) return 'This user has not purchased any records yet.';

    const enriched = await Promise.all(Items.map(async (p) => {
      const { Item } = await docClient.send(new GetCommand({
        TableName: 'vv_records',
        Key: { recordId: p.recordId },
      }));
      return {
        title: Item?.title || 'Unknown',
        artist: Item?.artist || 'Unknown',
        genre: Item?.genre || 'Unknown',
        purchasedAt: p.purchasedAt,
      };
    }));

    return JSON.stringify(enriched);
  },
  {
    name: 'get_user_purchases',
    description: 'Fetches all records this user has purchased, to understand their taste and buying history.',
    schema: z.object({ userId: z.string().describe('The user ID to fetch purchases for') }),
  }
);

const searchRecords = tool(
  async ({ genre, artist, minRating }) => {
    const { Items } = await docClient.send(new ScanCommand({ TableName: 'vv_records' }));
    if (!Items) return '[]';

    let results = Items;
    if (genre) results = results.filter(r => r.genre?.toLowerCase() === genre.toLowerCase());
    if (artist) results = results.filter(r => r.artist?.toLowerCase().includes(artist.toLowerCase()));
    if (minRating) results = results.filter(r => r.avgRating >= minRating);

    const summary = results.map(r => ({
      recordId: r.recordId,
      title: r.title,
      artist: r.artist,
      genre: r.genre,
      year: r.year,
      price: r.price,
      avgRating: r.avgRating,
      ratingCount: r.ratingCount,
    }));

    return summary.length > 0 ? JSON.stringify(summary) : 'No records found matching those filters.';
  },
  {
    name: 'search_records',
    description: 'Search the record catalog by genre, artist name, or minimum community rating. Use this to find records to recommend.',
    schema: z.object({
      genre: z.string().optional().describe('Filter by genre (e.g. Jazz, Rock, Electronic)'),
      artist: z.string().optional().describe('Filter by artist name (partial match)'),
      minRating: z.number().optional().describe('Minimum average community rating (1–5)'),
    }),
  }
);

const getRecordDetails = tool(
  async ({ recordId }) => {
    const { Item } = await docClient.send(new GetCommand({
      TableName: 'vv_records',
      Key: { recordId },
    }));
    if (!Item) return 'Record not found.';
    return JSON.stringify(Item);
  },
  {
    name: 'get_record_details',
    description: 'Get full details for a specific record by its ID, including tracklist and description.',
    schema: z.object({ recordId: z.string().describe('The record ID to look up') }),
  }
);

module.exports = { getUserRatings, getUserPurchases, searchRecords, getRecordDetails };
