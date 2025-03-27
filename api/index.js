require('dotenv').config();
const express = require('express');
const connectDB = require('./db');
const Inquiry = require('./models/inquiry');
const whatsapp = require('../services/whatsapp');

// Initialize Express app
const app = express();
app.use(express.json());

// Connect to MongoDB
connectDB();

// Store user sessions
const sessions = {};

// Initialize a session
function initSession(phone) {
  return {
    step: 'greeting',
    data: {
      phone: phone
    },
    lastActivity: Date.now()
  };
}

// Get or create a session
function getSession(phone) {
  // Clean up old sessions (older than 30 minutes)
  const now = Date.now();
  Object.keys(sessions).forEach(key => {
    if (now - sessions[key].lastActivity > 30 * 60 * 1000) {
      delete sessions[key];
    }
  });

  if (!sessions[phone]) {
    sessions[phone] = initSession(phone);
  }
  
  sessions[phone].lastActivity = now;
  return sessions[phone];
}

// Webhook verification endpoint
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('Webhook verified');
    return res.status(200).send(challenge);
  } else {
    console.log('Webhook verification failed');
    return res.sendStatus(403);
  }
});


// Webhook for receiving messages
app.post('/webhook', async (req, res) => {
  try {
    // Ensure this is a WhatsApp message
    if (!req.body.object || !req.body.entry || !req.body.entry[0].changes || !req.body.entry[0].changes[0].value.messages) {
      return res.sendStatus(200);
    }

    const message = req.body.entry[0].changes[0].value.messages[0];
    const phone = message.from;
    
    // Process the message
    await processMessage(phone, message);
    
    return res.sendStatus(200);
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.sendStatus(500);
  }
});

// Process incoming messages
async function processMessage(phone, message) {
  const session = getSession(phone);
  
  // Handle different message types
  if (message.type === 'interactive') {
    if (message.interactive.type === 'button_reply') {
      await handleButtonReply(phone, message.interactive.button_reply.id, session);
    } else if (message.interactive.type === 'list_reply') {
      await handleListReply(phone, message.interactive.list_reply.id, session);
    }
  } else if (message.type === 'text') {
    await handleTextMessage(phone, message.text.body, session);
  }
}

// Handle text messages
async function handleTextMessage(phone, text, session) {
  switch (session.step) {
    case 'greeting':
      await whatsapp.sendTextMessage(phone, "👋 Welcome to Guhan Industrial Manufacturing Solutions! We're here to help with your industrial needs.");
      await whatsapp.sendReplyButtons(phone, "To get started, please let me know how I can assist you today:", [
        { id: "products", title: "Product Catalog" },
        { id: "support", title: "Technical Support" },
        { id: "custom", title: "Custom Solutions" }
      ]);
      session.step = 'main_menu';
      break;
      
    case 'waiting_name':
      session.data.name = text;
      session.step = 'waiting_email';
      await whatsapp.sendTextMessage(phone, `Thanks, ${text}! Please share your email address so we can follow up with you.`);
      break;
      
    case 'waiting_email':
      // Simple email validation
      if (!text.includes('@') || !text.includes('.')) {
        await whatsapp.sendTextMessage(phone, "That doesn't look like a valid email address. Please try again.");
        return;
      }
      
      session.data.email = text;
      session.step = 'waiting_company';
      await whatsapp.sendTextMessage(phone, "Great! What company do you represent?");
      break;
      
    case 'waiting_company':
      session.data.company = text;
      session.step = 'waiting_message';
      await whatsapp.sendTextMessage(phone, "Thank you for the information. Please briefly describe your inquiry or requirements:");
      break;
      
    case 'waiting_message':
      session.data.message = text;
      
      // Create and save the inquiry
      const inquiry = new Inquiry({
        name: session.data.name,
        phone: session.data.phone,
        email: session.data.email,
        company: session.data.company,
        inquiryType: session.data.inquiryType || 'Product Catalog',
        message: session.data.message
      });
      
      await inquiry.save();
      
      // Send confirmation
      await whatsapp.sendTextMessage(phone, "✅ Thank you for your inquiry! Our team will review your request and get back to you within 24 hours.");
      await whatsapp.sendReplyButtons(phone, "Is there anything else I can help you with?", [
        { id: "new_inquiry", title: "New Inquiry" },
        { id: "end_chat", title: "End Chat" }
      ]);
      
      session.step = 'follow_up';
      break;
      
    default:
      // If we don't recognize the step, restart the conversation
      await whatsapp.sendTextMessage(phone, "I'm not sure where we left off. Let's start again.");
      await whatsapp.sendReplyButtons(phone, "How can I assist you today?", [
        { id: "products", title: "Product Catalog" },
        { id: "support", title: "Technical Support" },
        { id: "custom", title: "Custom Solutions" }
      ]);
      session.step = 'main_menu';
      break;
  }
}

// Handle button replies
async function handleButtonReply(phone, buttonId, session) {
  switch (session.step) {
    case 'main_menu':
      if (buttonId === 'products') {
        session.data.inquiryType = 'Product Catalog';
        await sendProductCategories(phone);
        session.step = 'product_category';
      } else if (buttonId === 'support') {
        session.data.inquiryType = 'Technical Support';
        await whatsapp.sendTextMessage(phone, "Our technical support team is ready to assist you. To better help you, we'll need some information.");
        await whatsapp.sendTextMessage(phone, "Please tell me your name:");
        session.step = 'waiting_name';
      } else if (buttonId === 'custom') {
        session.data.inquiryType = 'Custom Solutions';
        await whatsapp.sendTextMessage(phone, "Our engineering team specializes in custom industrial solutions. To discuss your specific needs, we'll need some information.");
        await whatsapp.sendTextMessage(phone, "Please tell me your name:");
        session.step = 'waiting_name';
      }
      break;
      
    case 'product_category':
      session.data.productCategory = buttonId;
      await whatsapp.sendTextMessage(phone, "Great choice! To provide you with detailed information about our products, we'll need some contact information.");
      await whatsapp.sendTextMessage(phone, "Please tell me your name:");
      session.step = 'waiting_name';
      break;
      
    case 'follow_up':
      if (buttonId === 'new_inquiry') {
        // Reset session but keep basic info
        const basicInfo = {
          name: session.data.name,
          phone: session.data.phone,
          email: session.data.email,
          company: session.data.company
        };
        
        session.step = 'main_menu';
        session.data = basicInfo;
        
        await whatsapp.sendReplyButtons(phone, "How can I assist you with your new inquiry?", [
          { id: "products", title: "Product Catalog" },
          { id: "support", title: "Technical Support" },
          { id: "custom", title: "Custom Solutions" }
        ]);
      } else if (buttonId === 'end_chat') {
        await whatsapp.sendTextMessage(phone, "Thank you for contacting Guhan Industrial Manufacturing Solutions. Have a great day!");
        // Clear the session
        delete sessions[phone];
      }
      break;
  }
}

// Handle list replies
async function handleListReply(phone, listItemId, session) {
  // Process list selections (for product subcategories, etc.)
  if (session.step === 'product_subcategory') {
    session.data.specificProduct = listItemId;
    await whatsapp.sendTextMessage(phone, `You've selected: ${listItemId}`);
    await whatsapp.sendTextMessage(phone, "To provide you with detailed information about this product, we'll need some contact information.");
    await whatsapp.sendTextMessage(phone, "Please tell me your name:");
    session.step = 'waiting_name';
  }
}

// Send product categories
async function sendProductCategories(phone) {
  await whatsapp.sendReplyButtons(
    phone,
    "We offer a wide range of industrial products. Please select a category you're interested in:",
    [
      { id: "machinery", title: "Industrial Machinery" },
      { id: "components", title: "Machine Components" },
      { id: "tools", title: "Precision Tools" }
    ]
  );
}

// Middleware
app.get('/', (req, res) => {
  res.send('Welcome to GIMS Industry WhatsApp Bot API!');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Export the app for Vercel
module.exports = app;

// Start the server
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle port in use error
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is in use, trying port ${Number(PORT) + 1}...`);
    app.listen(Number(PORT) + 1);
  } else {
    console.error('Server error:', error);
    process.exit(1);
  }
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

// Clean up old sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(sessions).forEach(key => {
    if (now - sessions[key].lastActivity > 30 * 60 * 1000) {
      delete sessions[key];
    }
  });
}, 5 * 60 * 1000);


