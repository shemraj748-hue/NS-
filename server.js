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

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Ensure data folder exists
fs.ensureDirSync(DATA_DIR);
if (!fs.existsSync(POSTS_FILE))
  fs.writeJsonSync(POSTS_FILE, { posts: [], lastCheckedVideoId: null });

// ✉️ Nodemailer (Gmail direct send)
let transporter = null;
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.log('Gmail transporter configured');
} else {
  console.warn('⚠️ Gmail not configured. Please set SMTP_USER and SMTP_PASS in .env');
}

// 🔔 Helper to send owner notification
async function notifyOwner(subject, text) {
  if (!transporter) {
    console.log('No mail transporter configured. Skipping email.');
    return;
  }
  try {
    await transporter.sendMail({
      from: `"Naveen Sharma Academy" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject,
      text
    });
    console.log('📩 Email sent:', subject);
  } catch (err) {
    console.error('Failed to send email:', err.message);
  }
}

// 📄 Get blog posts
app.get('/api/posts', async (req, res) => {
  try {
    const data = await fs.readJson(POSTS_FILE);
    res.json({ ok: true, posts: data.posts || [] });
  } catch (err) {
    console.error('Failed to read posts:', err.message);
    res.status(500).json({ ok: true, posts: [] });
  }
});

// 📬 Contact form
app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body || {};
  if (!name || !email || !message)
    return res.status(400).json({ ok: false, error: 'Missing fields' });

  const logFile = path.join(DATA_DIR, 'contacts.json');

  try {
    // Save locally
    const contacts = fs.existsSync(logFile) ? await fs.readJson(logFile) : [];
    contacts.unshift({ name, email, message, time: new Date().toISOString() });
    await fs.writeJson(logFile, contacts, { spaces: 2 });

    // Send email via Gmail
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER,
      subject: `New message from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
    });

    res.json({ ok: true, message: 'Message sent successfully!' });
  } catch (err) {
    console.error('Contact form failed:', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// 💳 Stripe (optional)
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  console.log('Stripe initialized');
}

// Create payment intent
app.post('/api/create-payment-intent', async (req, res) => {
  if (!stripe)
    return res.status(400).json({ ok: false, error: 'Stripe not configured' });

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
  if (!process.env.STRIPE_WEBHOOK_SECRET)
    return res.status(400).send('Webhook not configured');
  const sig = req.headers['stripe-signature'];
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object;
      await notifyOwner('Payment Received', `PaymentIntent ${intent.id} received. Amount: ${intent.amount_received}`);
    }
    res.json({ received: true });
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// 🚀 Start Server and YouTube Sync
app.listen(PORT, async () => {
  console.log(`✅ Server running on port ${PORT}`);

  try {
    await youtubeSync.start({
      postsFile: POSTS_FILE,
      notifyOwner,
      youtubeApiKey: process.env.YOUTUBE_API_KEY,
      channelId: process.env.YOUTUBE_CHANNEL_ID
    });
    console.log('🎥 YouTube sync started successfully');
  } catch (err) {
    console.error('YouTube sync failed:', err.message);
  }
});
