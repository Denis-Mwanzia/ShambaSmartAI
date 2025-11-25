# ShambaSmart AI - Architecture Documentation

## System Overview

ShambaSmart AI is a multi-agent, multi-channel agricultural advisory system built for Kenyan farmers. It leverages Google Genkit, Vertex AI, and ADK to provide personalized, real-time agricultural intelligence.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Multi-Channel Layer                       │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│ WhatsApp │   SMS   │   USSD   │  Voice   │   Web Dashboard │
└────┬─────┴────┬─────┴────┬─────┴────┬─────┴────────┬────────┘
     │          │          │          │             │
     └──────────┴──────────┴──────────┴─────────────┘
                      │
              ┌───────▼────────┐
              │  API Gateway   │
              │   (Express)    │
              └───────┬────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
    ┌────▼─────────┐      ┌────────▼──────┐
    │   Channel    │      │  Agent         │
    │  Handlers    │      │  Orchestrator  │
    └────┬─────────┘      └────────┬───────┘
         │                        │
         │              ┌─────────┴─────────┐
         │              │                   │
    ┌────▼─────────┐   │   ┌───────────────▼──────────┐
    │   Database   │   │   │   Multi-Agent System       │
    │  (Firestore) │   │   ├───────────────────────────┤
    └──────────────┘   │   │ • Crop Advisor             │
                       │   │ • Livestock Health         │
                       │   │ • Pest Detection          │
                       │   │ • Climate Alert           │
                       │   │ • Market Intelligence     │
                       │   │ • Extension Support       │
                       │   │ • Translation             │
                       │   └───────────┬───────────────┘
                       │               │
              ┌────────┴───────────────┴────────┐
              │                                  │
       ┌──────▼──────┐                  ┌───────▼────────┐
       │   RAG       │                  │   Vertex AI    │
       │  Pipeline   │                  │   (Gemini)     │
       └──────┬──────┘                  └───────┬───────┘
              │                                  │
       ┌──────▼──────────────────────────────────▼──────┐
       │         Matching Engine (Vector Store)          │
       │  • KALRO Documents                              │
       │  • MOA Manuals                                  │
       │  • FAO Data                                    │
       │  • Weather Data                                │
       │  • Market Prices                               │
       └─────────────────────────────────────────────────┘
```

## Component Details

### 1. Multi-Channel Layer

#### WhatsApp Channel
- **Integration**: Meta Cloud API
- **Features**: Text messages, media support
- **Webhook**: `/webhook/whatsapp`
- **Use Case**: Smartphone users, rich media content

#### SMS Channel
- **Integration**: Africa's Talking API
- **Features**: Text-only messages
- **Webhook**: `/webhook/sms`
- **Use Case**: Feature phone users, basic queries

#### USSD Channel
- **Integration**: Africa's Talking
- **Features**: Menu-driven interface
- **Webhook**: `/webhook/ussd`
- **Use Case**: Feature phones, structured queries

#### Voice Channel
- **Integration**: Twilio
- **Features**: Speech-to-text, text-to-speech
- **Webhook**: `/webhook/voice`
- **Use Case**: Low-literacy users, hands-free access

#### Web Dashboard
- **Technology**: React + Tailwind CSS + PWA
- **Features**: Chat interface, history, quick actions
- **API**: `/api/chat`
- **Use Case**: Desktop/mobile web users

### 2. Agent Orchestrator

The orchestrator coordinates multiple specialized agents:

1. **Intent Classification**: Determines user intent from query
2. **Agent Selection**: Routes to appropriate agent(s)
3. **Response Combination**: Merges multi-agent responses
4. **Translation**: Converts to user's preferred language

### 3. Multi-Agent System

#### Crop Advisor Agent
- **Purpose**: Crop-specific agricultural advice
- **Inputs**: Crop type, region, soil, farm stage
- **Outputs**: Planting, growing, harvesting recommendations

#### Livestock Health Agent
- **Purpose**: Livestock management and health
- **Inputs**: Livestock type, symptoms, region
- **Outputs**: Disease diagnosis, treatment, prevention

#### Pest Detection Agent
- **Purpose**: Pest and disease identification
- **Inputs**: Symptoms, crop type, images (future)
- **Outputs**: Pest identification, control measures

#### Climate Alert Agent
- **Purpose**: Weather forecasts and alerts
- **Inputs**: Region, date range
- **Outputs**: Forecast, alerts (drought, flood, heat)

#### Market Intelligence Agent
- **Purpose**: Market prices and trading advice
- **Inputs**: Crop, region, date
- **Outputs**: Current prices, trends, best markets

#### Extension Support Agent
- **Purpose**: Support for extension officers
- **Inputs**: Technical questions, resources needed
- **Outputs**: Detailed technical information, resources

#### Translation Agent
- **Purpose**: Multi-language support
- **Inputs**: Text, source language, target language
- **Outputs**: Translated text (English ↔ Kiswahili)

### 4. RAG Pipeline

#### Data Sources
- **KALRO**: Publications, crop guides, livestock manuals
- **MOA**: Extension manuals, county-specific guides
- **FAO**: FAOSTAT data, locust updates, best practices
- **Weather**: Open-Meteo, Meteostat
- **Soil**: ISRIC SoilGrids, AfSIS
- **Market**: KNBS, HCD

#### Pipeline Flow
1. **Data Ingestion**: Scrape/download documents
2. **Preprocessing**: Convert PDFs to markdown, chunk documents
3. **Embedding**: Generate vectors using Vertex AI Embeddings
4. **Indexing**: Store in Matching Engine
5. **Retrieval**: Query with context-aware embeddings
6. **Generation**: Feed to Gemini for final response

### 5. Database (Firestore)

#### Collections

**users**
- User profile (phone, name, county, crops, livestock)
- Preferences (language, alert settings)
- Metadata

**messages**
- Chat history
- Channel, direction, content, timestamp
- Metadata (session ID, etc.)

**alerts**
- Weather, pest, market alerts
- Severity, type, delivery status

### 6. Services

#### Weather Service
- Fetches forecasts from Open-Meteo
- Generates alerts (drought, flood, heat)
- County-specific data

#### Market Service
- Fetches prices from KNBS/HCD
- Calculates trends
- Region-specific data

#### Alert Service
- Scheduled checks (hourly)
- User-specific alerts
- Multi-channel delivery

## Data Flow

### Query Processing Flow

1. **User sends message** via any channel
2. **Channel handler** receives and validates
3. **User lookup/creation** in Firestore
4. **Context extraction** (crop, region, intent)
5. **Agent orchestrator** classifies intent
6. **RAG retrieval** with context
7. **Agent processing** generates response
8. **Translation** (if needed)
9. **Response delivery** via original channel
10. **Message storage** in Firestore

### Alert Flow

1. **Scheduled job** runs hourly
2. **Weather check** for all regions
3. **Pest monitoring** (if integrated)
4. **Market analysis** for price changes
5. **User filtering** by region/crop
6. **Alert generation** and delivery
7. **Alert logging** in Firestore

## Technology Stack

### Backend
- **Runtime**: Node.js 20
- **Language**: TypeScript
- **Framework**: Express.js
- **AI Framework**: Google Genkit
- **AI Models**: Vertex AI (Gemini, Embeddings)
- **Vector Store**: Vertex Matching Engine
- **Database**: Firestore
- **Deployment**: Cloud Run

### Frontend
- **Framework**: React 18
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **PWA**: Vite PWA Plugin
- **HTTP Client**: Axios

### Channels
- **WhatsApp**: Meta Cloud API
- **SMS/USSD**: Africa's Talking
- **Voice**: Twilio

## Security

1. **Authentication**: Service account for GCP services
2. **Webhook Verification**: Token-based for WhatsApp
3. **Input Validation**: Zod schemas
4. **Error Handling**: Graceful degradation
5. **Rate Limiting**: (To be implemented)
6. **Data Privacy**: User data encryption

## Scalability

1. **Horizontal Scaling**: Cloud Run auto-scaling
2. **Caching**: (To be implemented - Redis)
3. **Database**: Firestore auto-scaling
4. **CDN**: For static assets
5. **Load Balancing**: Cloud Run handles

## Monitoring

1. **Logging**: Winston logger
2. **Metrics**: Cloud Monitoring
3. **Tracing**: Genkit tracing
4. **Alerts**: Cloud Alerting

## Future Enhancements

1. **Image Recognition**: Pest/disease from photos
2. **Voice Input/Output**: Full voice support
3. **Offline Mode**: PWA offline capabilities
4. **Analytics Dashboard**: Usage metrics
5. **A/B Testing**: Response optimization
6. **Multi-language**: More languages beyond English/Kiswahili
7. **Integration**: More data sources (satellite, IoT)

