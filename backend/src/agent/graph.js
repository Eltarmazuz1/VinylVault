const { createReactAgent } = require('@langchain/langgraph/prebuilt');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { getUserRatings, getUserPurchases, searchRecords, getRecordDetails } = require('./tools');

const tools = [getUserRatings, getUserPurchases, searchRecords, getRecordDetails];

const model = new ChatGoogleGenerativeAI({
  model: 'gemini-3.1-flash-lite',
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0.7,
});

const graph = createReactAgent({ llm: model, tools });

const SYSTEM_PROMPT = `You are VinylVault's music recommendation assistant.
You have access to the user's rating history and purchases, and can search the record catalog.

Your job:
1. Use get_user_ratings and get_user_purchases to understand the user's taste (genres they love, artists they gravitate toward, what they score highly)
2. Use search_records to find records that match their taste profile
3. Recommend 3–5 specific records with clear reasoning tied to their history
4. Be conversational, enthusiastic about music, and specific about WHY each pick suits them

Never make up record titles or artists. Only recommend records that exist in the catalog from your search results.
If the user has no history yet, ask what genres or artists they enjoy and search based on that.`;

async function runAgent(userId, userMessage, threadId) {
  const result = await graph.invoke(
    {
      messages: [
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(`[User ID: ${userId}]\n\n${userMessage}`),
      ],
    },
    { configurable: { thread_id: threadId } }
  );

  const messages = result.messages;
  const last = messages[messages.length - 1];
  return typeof last.content === 'string' ? last.content : JSON.stringify(last.content);
}

module.exports = { runAgent };
