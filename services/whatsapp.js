const axios = require('axios');
require('dotenv').config();

class WhatsAppService {
  constructor() {
    if (!process.env.WHATSAPP_TOKEN || !process.env.PHONE_NUMBER_ID) {
      throw new Error('Missing WhatsApp API credentials');
    }

    this.token = process.env.WHATSAPP_TOKEN;
    this.phoneNumberId = process.env.PHONE_NUMBER_ID;
    this.baseUrl = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;
    this.headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  async _makeRequest(payload) {
    try {
      const response = await axios.post(this.baseUrl, payload, {
        headers: this.headers,
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('❌ WhatsApp API Error:', {
        status: error.response?.status,
        error: error.response?.data?.error || error.message
      });
      throw new Error('Failed to send message');
    }
  }

  async sendTextMessage(to, text) {
    return this._makeRequest({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'text',
      text: { body: text }
    });
  }

  async sendReplyButtons(to, bodyText, buttons) {
    return this._makeRequest({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.map((btn, index) => ({
            type: 'reply',
            reply: {
              id: btn.id || `btn_${index}`,
              title: btn.title
            }
          }))
        }
      }
    });
  }

  async sendList(to, bodyText, buttonText, sections) {
    return this._makeRequest({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText },
        action: {
          button: buttonText,
          sections: sections
        }
      }
    });
  }

  async sendImage(to, imageUrl, caption = "") {
    return this._makeRequest({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'image',
      image: {
        link: imageUrl,
        caption: caption
      }
    });
  }

  async sendDocument(to, documentUrl, filename, caption = "") {
    return this._makeRequest({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'document',
      document: {
        link: documentUrl,
        filename: filename,
        caption: caption
      }
    });
  }
}

module.exports = new WhatsAppService();
