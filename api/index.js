require('dotenv').config();
const express = require('express');
const connectDB = require('./db');
const Inquiry = require('../models/inquiry');
const whatsapp = require('../services/whatsapp');

const app = express();
app.use(express.json());
connectDB();

// Session management
const sessions = new Map();
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

const createSession = (phone) => ({
  step: 'greeting',
  data: { phone },
  lastActivity: Date.now()
});

const getSession = (phone) => {
  const now = Date.now();
  
  // Cleanup old sessions
  sessions.forEach((session, key) => {
    if (now - session.lastActivity > SESSION_TTL) {
      sessions.delete(key);
    }
  });

  if (!sessions.has(phone)) {
    sessions.set(phone, createSession(phone));
  }
  
  const session = sessions.get(phone);
  session.lastActivity = now;
  return session;
};

// Webhook verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    return res.status(200).send(challenge);
  }
  console.log('❌ Webhook verification failed');
  return res.sendStatus(403);
});

// Message processing
app.post('/webhook', async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const messages = changes?.value?.messages;

    if (messages?.length) {
      const message = messages[0];
      const phone = message.from;
      const session = getSession(phone);
      
      await processMessage(phone, message, session);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('⚠️ Webhook processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add above other routes
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'active',
    version: process.env.npm_package_version,
    node: process.version
  });
});

async function processMessage(phone, message, session) {
  try {
    if (message.type === 'interactive') {
      const interaction = message.interactive;
      if (interaction.type === 'button_reply') {
        await handleButtonReply(phone, interaction.button_reply.id, session);
      } else if (interaction.type === 'list_reply') {
        await handleListReply(phone, interaction.list_reply.id, session);
      }
    } else if (message.type === 'text') {
      await handleTextMessage(phone, message.text.body, session);
    } else {
      await whatsapp.sendTextMessage(phone, "⚠️ Unsupported message type");
    }
  } catch (error) {
    console.error(`❌ Error processing message from ${phone}:`, error);
    await whatsapp.sendTextMessage(phone, "⚠️ Temporary system error. Please try again.");
  }
}

async function handleTextMessage(phone, text, session) {
  switch (session.step) {
    case 'greeting':
      await whatsapp.sendTextMessage(phone, "👋 Welcome to Guhan Industrial Manufacturing Solutions!");
      await whatsapp.sendReplyButtons(phone, "How can I assist you today?", [
        { id: "products", title: "Product Catalog" },
        { id: "support", title: "Technical Support" },
        { id: "custom", title: "Custom Solutions" }
      ]);
      session.step = 'main_menu';
      break;

    case 'waiting_name':
      session.data.name = text;
      session.step = 'waiting_email';
      await whatsapp.sendTextMessage(phone, `Thanks ${text}! Please enter your email address.`);
      break;

    case 'waiting_email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
        await whatsapp.sendTextMessage(phone, "❌ Invalid email format. Please try again.");
        return;
      }
      session.data.email = text;
      session.step = 'waiting_company';
      await whatsapp.sendTextMessage(phone, "Please enter your company name:");
      break;

    case 'waiting_company':
      session.data.company = text;
      session.step = 'waiting_message';
      await whatsapp.sendTextMessage(phone, "Please describe your inquiry:");
      break;

    case 'waiting_message':
      session.data.message = text;
      await saveInquiry(session.data);
      await whatsapp.sendTextMessage(phone, "✅ Inquiry received! We'll contact you within 24 hours.");
      await whatsapp.sendReplyButtons(phone, "Need anything else?", [
        { id: "new_inquiry", title: "New Inquiry" },
        { id: "end_chat", title: "End Chat" }
      ]);
      session.step = 'follow_up';
      break;

    default:
      await whatsapp.sendTextMessage(phone, "⚠️ Session reset. Let's start over.");
      session.step = 'greeting';
      await handleTextMessage(phone, '', session);
  }
}

async function handleButtonReply(phone, buttonId, session) {
  switch (session.step) {
    case 'main_menu':
      if (buttonId === 'products') {
        session.data.inquiryType = 'Product Catalog';
        await sendProductCategories(phone);
        session.step = 'product_category';
      } else if (buttonId === 'support') {
        session.data.inquiryType = 'Technical Support';
        await whatsapp.sendTextMessage(phone, "Please enter your name:");
        session.step = 'waiting_name';
      } else if (buttonId === 'custom') {
        session.data.inquiryType = 'Custom Solutions';
        await whatsapp.sendTextMessage(phone, "Please enter your name:");
        session.step = 'waiting_name';
      }
      break;

    case 'follow_up':
      if (buttonId === 'new_inquiry') {
        session.step = 'greeting';
        session.data = { phone: session.data.phone };
        await handleTextMessage(phone, '', session);
      } else if (buttonId === 'end_chat') {
        sessions.delete(phone);
        await whatsapp.sendTextMessage(phone, "👋 Thank you for contacting us!");
      }
      break;
  }
}

async function sendProductCategories(phone) {
  await whatsapp.sendReplyButtons(
    phone,
    "Select a product category:",
    [
      { id: "machinery", title: "Industrial Machinery" },
      { id: "components", title: "Machine Components" },
      { id: "tools", title: "Precision Tools" }
    ]
  );
}

async function saveInquiry(data) {
  const inquiry = new Inquiry({
    name: data.name,
    phone: data.phone,
    email: data.email,
    company: data.company,
    inquiryType: data.inquiryType,
    productCategory: data.productCategory,
    message: data.message,
    status: 'New'
  });
  await inquiry.save();
}

// Cleanup old sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  sessions.forEach((session, phone) => {
    if (now - session.lastActivity > SESSION_TTL) {
      sessions.delete(phone);
    }
  });
}, 300000);

// Export the Express app for Vercel
module.exports = app;
