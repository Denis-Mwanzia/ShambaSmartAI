# ShambaSmart AI

**Kenya's AI-Powered Agricultural Advisor for Every Farmer**

🌐 **Live Demo**: https://shambasmart-ai-896121198699.us-central1.run.app

## Overview

ShambaSmart AI is a multi-agent, multi-channel agricultural advisor built using Google Genkit, Vertex AI, and ADK. It delivers context-aware agricultural intelligence through WhatsApp, SMS, USSD, Voice and a mobile web dashboard.

## Features

- 🤖 **Multi-Agent System**: Coordinated team of AI agents for crops, livestock, pests, climate, market intelligence, and extension support
- 📱 **Multi-Channel Access**: WhatsApp, SMS, USSD, Voice, and Web Dashboard
- 🌍 **Kenya-Specific**: RAG pipeline with KALRO, MOA, and FAO datasets
- 🌦️ **Real-Time Alerts**: Weather forecasts, pest warnings, market prices
- 🌐 **Bilingual Support**: English and Kiswahili with high-quality translations
- 📊 **Personalized Advisory**: Tailored recommendations based on crop, region, soil, and farm stage
- 📍 **Location-Aware**: Geolocation support for region-specific advice
- ⚡ **Response Caching**: Fast responses for common queries

## Tech Stack

### Backend
- Node.js + TypeScript
- Google Genkit
- Google Vertex AI (Gemini 2.0 Flash)
- Google Cloud Run
- Firestore
- Vertex AI Matching Engine (RAG)

### Frontend
- React + TypeScript
- Tailwind CSS
- Progressive Web App (PWA)
- Responsive design (mobile-first)

### Channels
- WhatsApp (Meta Cloud API)
- SMS/USSD (Africa's Talking)
- Voice (Twilio)

## Project Structure

```
ShambaSmartAI/
├── src/
│   ├── agents/              # AI agents (crop, livestock, pest, climate, market, extension, translation)
│   │   └── system-instructions/  # Agent system prompts
│   ├── channels/            # Channel integrations (web, sms, whatsapp, ussd, voice)
│   ├── rag/                 # RAG pipeline
│   ├── services/            # Business logic (database, weather, market, alerts)
│   ├── models/              # Data models
│   ├── utils/               # Utilities (genkit-helper, logger, query-analyzer, input-validator)
│   └── index.ts             # Entry point
├── frontend/                # React frontend
│   ├── src/
│   │   ├── App.tsx          # Main app component
│   │   └── components/      # UI components
│   └── dist/                # Production build
├── data/                    # Agricultural data sources
│   └── sources/             # JSON datasets (pests, livestock, planting calendars, soil tips)
└── docs/                    # Documentation
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Send message to chatbot |
| `/api/chat/history` | GET | Get chat history |
| `/api/user/location` | POST | Update user location |
| `/webhook/sms` | POST | Africa's Talking SMS webhook |
| `/webhook/whatsapp` | POST | Meta WhatsApp webhook |
| `/webhook/ussd` | POST | Africa's Talking USSD webhook |
| `/webhook/voice` | POST | Twilio Voice webhook |
| `/health` | GET | Health check |

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   cd frontend && npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

   Required environment variables:
   ```
   GOOGLE_CLOUD_PROJECT_ID=your-project-id
   GOOGLE_API_KEY=your-api-key
   FIRESTORE_DATABASE_ID=(default)
   ```

3. **Run Development Server**
   ```bash
   npm run dev          # Backend on port 8080
   cd frontend && npm run dev  # Frontend on port 5173
   ```

## Deployment

Deploy backend to Google Cloud Run:
```bash
gcloud run deploy shambasmart-ai \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated
```

Deploy frontend to Firebase Hosting, Vercel, or Netlify using the `frontend/dist` folder.

## Usage Examples

### English
```
User: How do I plant maize in Nakuru?
Bot: To plant maize in Nakuru, prepare your land during the long rains (March-May). 
     Plant seeds 5cm deep with 75cm row spacing and 30cm between plants...
```

### Kiswahili
```
User: Jinsi ya kupanda mahindi
Bot: Ili kupanda mahindi kwa ufanisi, tayarisha shamba lako kwa kulima na 
     hakikisha maji yanapita vizuri. Panda mbegu kwa kina cha sentimita 5...
```

## License

MIT License

