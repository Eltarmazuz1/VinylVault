# VinylVault

A full-stack music records store with an AI-powered recommendation agent. Browse, rate, and purchase classic and modern vinyl records — then let the AI advisor suggest what to listen to next based on your taste and collection history.

## Features

- **Record catalog** — browse 36+ albums across Jazz, Rock, Pop, Electronic, Hip-Hop, Folk, and more
- **Search & filter** — case-insensitive search by title or artist; genre filter includes partial matches (e.g. "Pop" matches "Indie Pop", "Pop/Country")
- **Ratings & reviews** — rate records 1–5 stars and leave written reviews; community average updates in real time
- **Purchases** — add records to your collection
- **AI recommendation agent** — powered by LangGraph + Google Gemini; analyzes your ratings and purchases to recommend records tailored to your taste
- **JWT authentication** — register and log in; each user has their own collection and rating history

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, React Router |
| Backend | Node.js, Express 4 |
| Database | AWS DynamoDB |
| Storage | AWS S3 (album artwork) |
| AI Agent | LangGraph (`createReactAgent`), Google Gemini (`gemini-3.1-flash-lite`) |
| Auth | JWT + bcrypt |

## Project Structure

```
vinylvault/
├── frontend/               # React app (port 5173)
│   └── src/
│       ├── api/            # Axios API client
│       ├── components/     # Navbar, RecordCard, StarRating, AiChat, AuthModal
│       ├── context/        # AuthContext (JWT)
│       └── pages/          # Catalog, RecordDetail, Profile
└── backend/                # Express API (port 4000)
    ├── src/
    │   ├── agent/          # LangGraph graph + tool definitions
    │   ├── db/             # DynamoDB client
    │   ├── middleware/      # JWT auth guard
    │   ├── routes/         # auth, records, ratings, purchases, agent
    │   └── s3/             # S3 client
    ├── scripts/            # DB setup, seeding, artwork fixing
    └── tests/              # Jest test suites (19 tests)
```

## AI Agent

The recommendation agent uses LangGraph's `createReactAgent` with four tools:

| Tool | Purpose |
|------|---------|
| `get_user_ratings` | Fetch and enrich the user's rating history |
| `get_user_purchases` | Fetch and enrich the user's purchase history |
| `search_records` | Search the catalog by genre, artist, or minimum rating |
| `get_record_details` | Get full details for a specific record |

The agent analyzes the user's taste profile from their history, searches the catalog for matching records, and returns personalized recommendations with explicit reasoning.

## Getting Started

### Prerequisites

- Node.js ≥ 20
- AWS account with DynamoDB and S3 access
- Google AI API key (Gemini)

### Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/Eltarmazuz1/VinylVault.git
   cd VinylVault
   ```

2. **Backend config** — create `backend/.env` from the example:
   ```bash
   cp backend/.env.example backend/.env
   # Fill in your AWS credentials, S3 bucket name, JWT secret, and Google API key
   ```

3. **Create DynamoDB tables**
   ```bash
   cd backend
   npm install
   npm run setup:db
   ```

4. **Seed the catalog**
   ```bash
   npm run seed           # classic records
   npm run seed:artists   # Taylor Swift & Lana Del Rey discographies with S3 artwork
   ```

5. **Start the backend**
   ```bash
   npm run dev   # port 4000
   ```

6. **Start the frontend**
   ```bash
   cd ../frontend
   npm install
   npm run dev   # port 5173
   ```

7. Open [http://localhost:5173](http://localhost:5173)

### Running Tests

```bash
cd backend
npm test
```

19 tests across 3 suites: record routes, rating routes, and agent tool contracts.

## Environment Variables

Create `backend/.env` with:

```env
PORT=4000
JWT_SECRET=your_secret_here
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET_NAME=your_bucket_name
GOOGLE_API_KEY=your_gemini_api_key
```
