const nodemailer = require('nodemailer');
const { Telegraf } = require('telegraf');
require('dotenv').config();

let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

// Telegram bot setup
let bot = null;
if (process.env.TELEGRAM_BOT_TOKEN) {
  bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
}

async function notifyOwner(subject, text) {
  // Email
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Naveen Sharma UPSC" <${process.env.SMTP_USER}>`,
        to: process.env.SMTP_USER,
        subject,
        text
      });
      console.log('Email sent:', subject);
    } catch (err) {
      console.error('Email error:', err.message);
    }
  }
  
  // Telegram
  if (bot && process.env.TELEGRAM_CHAT_ID) {
    try {
      await bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, `*${subject}*\n${text}`, { parse_mode: 'Markdown' });
      console.log('Telegram message sent:', subject);
    } catch (err) {
      console.error('Telegram error:', err.message);
    }
  }
}

module.exports = { notifyOwner };
