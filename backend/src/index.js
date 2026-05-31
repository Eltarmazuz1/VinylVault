require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const recordsRoutes = require('./routes/records');
const ratingsRoutes = require('./routes/ratings');
const purchasesRoutes = require('./routes/purchases');
const agentRoutes = require('./routes/agent');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/records', recordsRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/agent', agentRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`VinylVault API running on port ${PORT}`));

module.exports = app;
