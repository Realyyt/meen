const mongoose = require('mongoose');

const InquirySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    index: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    validate: {
      validator: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      message: 'Invalid email format'
    }
  },
  company: {
    type: String,
    required: [true, 'Company name is required']
  },
  inquiryType: {
    type: String,
    enum: ['Product Catalog', 'Technical Support', 'Custom Solutions'],
    required: true
  },
  productCategory: String,
  specificProduct: String,
  message: String,
  status: {
    type: String,
    enum: ['New', 'In Progress', 'Resolved'],
    default: 'New',
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

InquirySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Inquiry', InquirySchema);
