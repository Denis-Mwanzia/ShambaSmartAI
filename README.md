# ShambaSmart AI

**Kenya's AI-Powered Agricultural Advisor for Every Farmer**

## Overview

ShambaSmart AI is a multi-agent, multi-channel agricultural advisor built using Google Genkit, Vertex AI, and ADK. It delivers context-aware agricultural intelligence through WhatsApp, SMS, USSD, Voice and a mobile web dashboard.

## Features

- 🤖 **Multi-Agent System**: Coordinated team of AI agents for crops, livestock, pests, climate, market intelligence, and extension support
- 📱 **Multi-Channel Access**: WhatsApp, SMS, USSD, Voice, and Web Dashboard
- 🌍 **Kenya-Specific**: RAG pipeline with KALRO, MOA, and FAO datasets
- 🌦️ **Real-Time Alerts**: Weather forecasts, pest warnings, market prices
- 🌐 **Multi-Language**: English and Kiswahili support
- 📊 **Personalized Advisory**: Tailored recommendations based on crop, region, soil, and farm stage

## Tech Stack

### Backend
- Node.js + TypeScript
- Google Genkit
- Google ADK (Agent Development Kit)
- Google Cloud Run
- Firestore
- Vertex AI (Embeddings + Gemini + Matching Engine)

### Frontend
- React + Tailwind CSS
- Progressive Web App (PWA)

### Channels
- WhatsApp (Meta Cloud API)
- SMS/USSD (Africa's Talking)
- Voice (Twilio/Africa's Talking)

## Project Structure

```
ShambaSmartAI/
├── src/
│   ├── agents/          # ADK agents
│   ├── channels/        # Channel integrations
│   ├── rag/            # RAG pipeline
│   ├── services/       # Business logic
│   ├── models/         # Data models
│   ├── utils/          # Utilities
│   └── index.ts        # Entry point
├── frontend/           # React frontend
├── data/              # Data ingestion scripts
└── docs/              # Documentation
```

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Set up Google Cloud**
   - Create a GCP project
   - Enable Vertex AI API
   - Create a service account with necessary permissions
   - Set up Matching Engine index

4. **Run Development Server**
   ```bash
   npm run dev
   ```

5. **Run Frontend**
   ```bash
   npm run dev:frontend
   ```

## Deployment

Deploy to Google Cloud Run:
```bash
gcloud run deploy shambasmart-ai --source .
```

## License

MIT License - See LICENSE file

