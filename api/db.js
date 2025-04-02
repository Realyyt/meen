const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    // Connect to MongoDB using default settings
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

// Event listeners for connection status
mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB connection lost');
});

mongoose.connection.on('reconnected', () => {
  console.log('♻️ MongoDB reconnected');
});

module.exports = connectDB;
