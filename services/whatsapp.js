const axios = require('axios');
require('dotenv').config();

class WhatsAppService {
  constructor() {
    this.token = process.env.WHATSAPP_TOKEN;
    this.phoneNumberId = process.env.PHONE_NUMBER_ID;
    this.baseUrl = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;
    this.headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  async sendTextMessage(to, text) {
    try {
      const response = await axios.post(
        this.baseUrl,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to,
          type: "text",
          text: { body: text }
        },
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error sending text message:', error.response?.data || error.message);
      throw new Error('Failed to send text message');
    }
  }

  async sendReplyButtons(to, bodyText, buttons) {
    try {
      const response = await axios.post(
        this.baseUrl,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to,
          type: "interactive",
          interactive: {
            type: "button",
            body: {
              text: bodyText
            },
            action: {
              buttons: buttons.map((btn, index) => ({
                type: "reply",
                reply: {
                  id: btn.id || `btn_${index}`,
                  title: btn.title
                }
              }))
            }
          }
        },
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error sending reply buttons:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendList(to, bodyText, buttonText, sections) {
    try {
      const response = await axios.post(
        this.baseUrl,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to,
          type: "interactive",
          interactive: {
            type: "list",
            body: {
              text: bodyText
            },
            action: {
              button: buttonText,
              sections: sections
            }
          }
        },
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error sending list message:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendImage(to, imageUrl, caption = "") {
    try {
      const response = await axios.post(
        this.baseUrl,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to,
          type: "image",
          image: {
            link: imageUrl,
            caption: caption
          }
        },
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error sending image:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendDocument(to, documentUrl, filename, caption = "") {
    try {
      const response = await axios.post(
        this.baseUrl,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to,
          type: "document",
          document: {
            link: documentUrl,
            filename: filename,
            caption: caption
          }
        },
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error sending document:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = new WhatsAppService();
