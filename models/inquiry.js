const mongoose = require('mongoose');

const InquirySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  company: {
    type: String,
    required: true
  },
  inquiryType: {
    type: String,
    enum: ['Product Catalog', 'Technical Support', 'Custom Solutions'],
    required: true
  },
  productCategory: {
    type: String,
    required: false
  },
  specificProduct: {
    type: String,
    required: false
  },
  message: {
    type: String,
    required: false
  },
  status: {
    type: String,
    enum: ['New', 'In Progress', 'Resolved'],
    default: 'New'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Inquiry', InquirySchema);
