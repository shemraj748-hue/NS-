require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const nodemailer = require('nodemailer');
const youtubeSync = require('./youtubeSync');
const Stripe = require('stripe');

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_DIR = path.join(__dirname, 'data');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');

app.use(cors({ origin: process.env.CLIENT_BASE_URL || '*' }));
app.use(bodyParser.json());

// Ensure data dir
fs.ensureDirSync(DATA_DIR);
if (!fs.existsSync(POSTS_FILE)) fs.writeJsonSync(POSTS_FILE, { posts: [], lastCheckedVideoId: null });

// Nodemailer
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

async function notifyOwner(subject, text) {
  console.log('Owner notification:', subject, text);
  if (!transporter) return;
  try {
    await transporter.sendMail({
      from: `"Naveen Sharma Academy" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject,
      text
    });
  } catch (err) { console.error('Failed to notify owner:', err.message); }
}

// GET /api/posts
app.get('/api/posts', async (req, res) => {
  try {
    const data = await fs.readJson(POSTS_FILE);
    res.json({ ok: true, posts: data.posts || [] });
  } catch (err) { res.status(500).json({ ok: false, error: 'Failed to read posts' }); }
});

// POST /api/contact
app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body || {};
  if (!name || !email || !message) return res.status(400).json({ ok: false, error: 'Missing fields' });

  const time = new Date().toISOString();
  const row = { name, email, message, time };
  try {
    const logFile = path.join(DATA_DIR, 'contacts.json');
    const contacts = fs.existsSync(logFile) ? await fs.readJson(logFile) : [];
    contacts.unshift(row);
    await fs.writeJson(logFile, contacts, { spaces: 2 });

    await notifyOwner('New Contact Form Submission', `Name: ${name}\nEmail: ${email}\nMessage:\n${message}\nTime: ${time}`);
    res.json({ ok: true, message: 'Received' });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// Stripe (optional)
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  console.log('Stripe initialized');
}

app.post('/api/create-payment-intent', async (req, res) => {
  if (!stripe) return res.status(400).json({ ok: false, error: 'Stripe not configured' });
  try {
    const { amount, currency = 'inr', description = 'Premium access' } = req.body;
    const intent = await stripe.paymentIntents.create({ amount: Math.round((amount || 999) * 100), currency, description });
    res.json({ ok: true, clientSecret: intent.client_secret });
  } catch (err) { res.status(500).json({ ok: false, error: 'Stripe error' }); }
});

// Stripe webhook
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) return res.status(400).send('Webhook not configured');
  const sig = req.headers['stripe-signature'];
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object;
      await notifyOwner('Payment Received', `PaymentIntent ${intent.id} received. Amount: ${intent.amount_received}`);
    }
    res.json({ received: true });
  } catch (err) { res.status(400).send(`Webhook Error: ${err.message}`); }
});

// Start server & YouTube sync
app.listen(PORT, async () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  try {
    await youtubeSync.start({
      postsFile: POSTS_FILE,
      notifyOwner,
      youtubeApiKey: process.env.YOUTUBE_API_KEY,
      channelId: process.env.YOUTUBE_CHANNEL_ID
    });
    console.log('YouTube sync started');
  } catch (err) { console.error('YouTube sync failed:', err.message); }
});
