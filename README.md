# GIMS Industry WhatsApp Bot

A WhatsApp bot for GIMS Industry that collects user information and service interests using an interactive conversation flow.

## Features

- Collects user information (name, email, company)
- Presents service options using interactive buttons
- Validates email addresses
- Provides a summary of collected information

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
- Copy `.env.example` to `.env`
- Adjust settings if needed

3. Start the bot:
```bash
node index.js
```

4. On first run:
- Scan the QR code with WhatsApp
- The session will be saved for future use

## Usage

Send any message to the bot to start the conversation. The bot will guide you through the following steps:

1. Ask for your name
2. Request your email address
3. Ask for your company name
4. Present service options via buttons
5. Provide a summary of your information

## Available Services

- Industrial Equipment
- Maintenance Services
- Spare Parts Supply
- Technical Consulting
- Custom Manufacturing
- Quality Inspection

## Development

The bot uses the `@mengkodingan/ckptw` library for WhatsApp integration. Session data is temporarily stored in memory. 