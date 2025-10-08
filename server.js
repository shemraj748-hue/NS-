require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const youtubeSync = require('./youtubeSync');
const Stripe = require('stripe');

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_DIR = path.join(__dirname, 'data');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');

// Allow all origins for frontend
app.use(cors());
app.use(bodyParser.json());

// Ensure data dir and files exist
fs.ensureDirSync(DATA_DIR);
if (!fs.existsSync(POSTS_FILE)) fs.writeJsonSync(POSTS_FILE, { posts: [], lastCheckedVideoId: null });

// API: Get posts
app.get('/api/posts', async (req, res) => {
  try {
    const data = await fs.readJson(POSTS_FILE);
    res.json({ ok: true, posts: data.posts || [] });
  } catch (err) {
    console.error('Failed to read posts:', err.message);
    res.status(500).json({ ok: true, posts: [] });
  }
});

// Stripe setup (optional)
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  console.log('Stripe initialized');
}

// Stripe create payment
app.post('/api/create-payment-intent', async (req, res) => {
  if (!stripe) return res.status(400).json({ ok: false, error: 'Stripe not configured' });
  try {
    const { amount, currency = 'inr', description = 'Premium access' } = req.body;
    const intent = await stripe.paymentIntents.create({
      amount: Math.round((amount || 999) * 100),
      currency,
      description
    });
    res.json({ ok: true, clientSecret: intent.client_secret });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ ok: false, error: 'Stripe error' });
  }
});

// Stripe webhook
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) return res.status(400).send('Webhook not configured');
  const sig = req.headers['stripe-signature'];
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object;
      console.log(`Payment received: ${intent.amount_received}`);
    }
    res.json({ received: true });
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// Start server and YouTube sync
app.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);

  try {
    await youtubeSync.start({
      postsFile: POSTS_FILE,
      youtubeApiKey: process.env.YOUTUBE_API_KEY,
      channelId: process.env.YOUTUBE_CHANNEL_ID
    });
    console.log('YouTube sync started successfully');
  } catch (err) {
    console.error('YouTube sync failed:', err.message);
  }
});
