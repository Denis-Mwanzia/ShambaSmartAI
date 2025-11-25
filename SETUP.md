# ShambaSmart AI - Setup Guide

🌐 **Live Demo**: https://shambasmart-ai-896121198699.us-central1.run.app

This guide will walk you through setting up ShambaSmart AI from scratch. Follow the steps in order.

## Prerequisites

### 1. Google Cloud Platform Account Setup

#### Step 1.1: Create a GCP Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click "New Project"
4. Enter project name: `shambasmart-ai` (or your preferred name)
5. Click "Create"
6. Note your **Project ID** (you'll need this later)

#### Step 1.2: Enable Required APIs
Run these commands in Cloud Shell or using `gcloud` CLI:

```bash
# Set your project ID
export PROJECT_ID=your-project-id
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable aiplatform.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable compute.googleapis.com
```

Or enable via Console:
- Go to "APIs & Services" > "Library"
- Search and enable each API:
  - Vertex AI API
  - Cloud Run API
  - Firestore API
  - Cloud Build API
  - Compute Engine API (for Matching Engine)

#### Step 1.3: Create Service Account
1. Go to "IAM & Admin" > "Service Accounts"
2. Click "Create Service Account"
3. Name: `shambasmart-service`
4. Click "Create and Continue"
5. Add these roles:
   - **Vertex AI User**
   - **Firestore User**
   - **Cloud Run Developer**
   - **Storage Admin** (for Matching Engine)
6. Click "Continue" > "Done"
7. Click on the created service account
8. Go to "Keys" tab > "Add Key" > "Create new key"
9. Choose "JSON" format
10. Download the key file (e.g., `shambasmart-key.json`)
11. **Save this file securely** - you'll need it for `GOOGLE_APPLICATION_CREDENTIALS`

### 2. Vertex AI Matching Engine Setup

#### Step 2.1: Create Matching Engine Index
**Option A: Using Console (Recommended for first-time setup)**

1. Go to Vertex AI > "Vector Search" in GCP Console
2. Click "Create Index"
3. Configure:
   - **Index name**: `shambasmart-index`
   - **Region**: `us-central1` (or your preferred region)
   - **Embedding dimension**: `768` (for textembedding-gecko@003)
   - **Distance measure**: `DOT_PRODUCT`
4. Click "Create"
5. **Note the Index ID** from the index details page

**Option B: Using gcloud CLI**
```bash
# Create index
gcloud ai indexes create \
  --display-name=shambasmart-index \
  --metadata-file=index-metadata.json \
  --region=us-central1
```

#### Step 2.2: Deploy Index Endpoint
1. In Vertex AI > "Vector Search" > "Index Endpoints"
2. Click "Create Index Endpoint"
3. Configure:
   - **Name**: `shambasmart-endpoint`
   - **Region**: Same as index (`us-central1`)
   - **Network**: Default VPC
4. Click "Create"
5. After creation, click "Deploy Index"
6. Select your index
7. Set **Min replica count**: 1
8. Click "Deploy"
9. **Note the Endpoint ID** from the endpoint details

**Important**: Wait for deployment to complete (can take 10-30 minutes)

### 3. Channel APIs Setup

#### Step 3.1: WhatsApp (Meta Cloud API)
1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app or use existing
3. Add "WhatsApp" product
4. Get your:
   - **Access Token** (from WhatsApp > API Setup)
   - **Phone Number ID** (from WhatsApp > API Setup)
   - **Verify Token** (create your own, e.g., `shambasmart-verify-2024`)

#### Step 3.2: Africa's Talking (SMS/USSD)
1. Sign up at [Africa's Talking](https://africastalking.com/)
2. Go to Dashboard > Settings > API
3. Get your:
   - **API Key**
   - **Username**
4. Set **Sender ID**: `SHAMBASMART` (or your preferred)

#### Step 3.3: Twilio (Voice)
1. Sign up at [Twilio](https://www.twilio.com/)
2. Get a phone number
3. From Console, get:
   - **Account SID**
   - **Auth Token**
   - **Phone Number** (format: +1234567890)

## Installation

### Step 1: Clone and Install Dependencies

```bash
# Navigate to project directory
cd ShambaSmartAI

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

**Troubleshooting**: If you encounter permission errors, use `sudo` (Linux/Mac) or run as Administrator (Windows).

### Step 2: Environment Configuration

#### Step 2.1: Create .env File

```bash
# Copy the example file
cp .env.example .env
```

#### Step 2.2: Edit .env File

Open `.env` in your editor and fill in the values:

```env
# Google Cloud (Required)
GOOGLE_CLOUD_PROJECT_ID=your-actual-project-id
GOOGLE_APPLICATION_CREDENTIALS=./shambasmart-key.json
VERTEX_AI_LOCATION=us-central1
MATCHING_ENGINE_INDEX_ID=1234567890123456789
MATCHING_ENGINE_INDEX_ENDPOINT_ID=9876543210987654321

# Genkit (Required)
GOOGLE_AI_API_KEY=AIzaSy...your-actual-api-key

# WhatsApp (Optional - for WhatsApp channel)
WHATSAPP_ACCESS_TOKEN=EAAx...
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_VERIFY_TOKEN=shambasmart-verify-2024

# Africa's Talking (Optional - for SMS/USSD)
AT_API_KEY=your-at-api-key
AT_USERNAME=your-at-username
AT_SENDER_ID=SHAMBASMART

# Twilio (Optional - for Voice)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Server (Optional - defaults provided)
PORT=8080
NODE_ENV=development
```

**Important Notes**:
- Use **absolute paths** for `GOOGLE_APPLICATION_CREDENTIALS` or relative to project root
- For **GOOGLE_AI_API_KEY**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey) or enable Vertex AI API and use service account
- You can start with just GCP credentials and add channel APIs later

#### Step 2.3: Verify Service Account File

Ensure your service account JSON file is in the project directory or update the path:

```bash
# Example: If key is in project root
GOOGLE_APPLICATION_CREDENTIALS=./shambasmart-key.json

# Example: If key is in a secure location
GOOGLE_APPLICATION_CREDENTIALS=/home/user/.gcp/shambasmart-key.json
```

### Step 3: Data Ingestion

Before running the application, you need to ingest agricultural data into the Matching Engine index.

#### Step 3.1: Build the Project

```bash
npm run build
```

#### Step 3.2: Run Data Ingestion

```bash
# Using npm script (recommended)
npm run ingest

# Or directly
tsx data/ingest.ts
```

**What this does**:
- Processes KALRO, MOA, and FAO documents
- Generates embeddings using Vertex AI
- Adds documents to Matching Engine index

**Expected Output**:
```
Starting data ingestion...
Ingesting KALRO data...
Ingested 1 KALRO documents
Ingesting MOA data...
Ingested 0 MOA documents
Ingesting FAO data...
Ingested 0 FAO documents
Ingesting custom structured data...
Custom data ingestion completed
Data ingestion completed successfully
```

**Note**: 
- First-time ingestion may take 10-30 minutes depending on data volume
- You can add more documents to `data/sources/` and re-run ingestion
- Ensure Matching Engine index is deployed before running

### Step 4: Build and Run

#### Step 4.1: Verify Setup

Before running, verify your setup:

```bash
# Check Node.js version (should be 18+)
node --version

# Check if .env file exists
ls -la .env

# Verify service account file exists
ls -la $GOOGLE_APPLICATION_CREDENTIALS
```

#### Step 4.2: Run Backend (Development)

**Terminal 1 - Backend Server:**
```bash
npm run dev
```

You should see:
```
ShambaSmart AI server running on port 8080
Genkit initialized successfully
```

**Test the server:**
```bash
curl http://localhost:8080/health
```

Expected response:
```json
{"status":"ok","service":"ShambaSmart AI"}
```

#### Step 4.3: Run Frontend (Development)

**Terminal 2 - Frontend:**
```bash
npm run dev:frontend
```

Or:
```bash
cd frontend
npm run dev
```

Frontend will be available at: `http://localhost:3000`

#### Step 4.4: Production Build

**Backend:**
```bash
npm run build
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
# Serve the dist folder with a static server
```

## Deployment

### Google Cloud Run Deployment

#### Step 1: Prepare for Deployment

Ensure you have:
- ✅ GCP project created
- ✅ APIs enabled
- ✅ Service account with proper roles
- ✅ gcloud CLI installed and authenticated

```bash
# Authenticate gcloud
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

#### Step 2: Build and Deploy

**Option A: Using Cloud Build (Recommended)**

```bash
# Submit build
gcloud builds submit --config cloudbuild.yaml

# This will:
# 1. Build Docker image
# 2. Push to Container Registry
# 3. Deploy to Cloud Run
```

**Option B: Manual Deployment**

```bash
# Deploy from source
gcloud run deploy shambasmart-ai \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10
```

#### Step 3: Set Environment Variables

After deployment, set environment variables:

```bash
# Set all environment variables at once
gcloud run services update shambasmart-ai \
  --region us-central1 \
  --update-env-vars \
    GOOGLE_CLOUD_PROJECT_ID=your-project-id,\
    VERTEX_AI_LOCATION=us-central1,\
    MATCHING_ENGINE_INDEX_ID=your-index-id,\
    MATCHING_ENGINE_INDEX_ENDPOINT_ID=your-endpoint-id,\
    GOOGLE_AI_API_KEY=your-api-key,\
    WHATSAPP_ACCESS_TOKEN=your-token,\
    WHATSAPP_PHONE_NUMBER_ID=your-phone-id,\
    WHATSAPP_VERIFY_TOKEN=your-verify-token,\
    AT_API_KEY=your-at-key,\
    AT_USERNAME=your-at-username,\
    TWILIO_ACCOUNT_SID=your-sid,\
    TWILIO_AUTH_TOKEN=your-token,\
    TWILIO_PHONE_NUMBER=your-number,\
    PORT=8080,\
    NODE_ENV=production
```

**Or set individually:**
```bash
gcloud run services update shambasmart-ai \
  --update-env-vars GOOGLE_CLOUD_PROJECT_ID=your-project-id \
  --region us-central1
```

#### Step 4: Get Service URL

```bash
gcloud run services describe shambasmart-ai \
  --region us-central1 \
  --format 'value(status.url)'
```

Save this URL - you'll need it for webhook configuration.

### Webhook Configuration

After deployment, configure webhooks for each channel:

#### WhatsApp Webhook Setup

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Select your app > WhatsApp > Configuration
3. Under "Webhook", click "Edit"
4. Enter:
   - **Callback URL**: `https://your-service-url.run.app/webhook/whatsapp`
   - **Verify Token**: Your `WHATSAPP_VERIFY_TOKEN` from .env
5. Click "Verify and Save"
6. Subscribe to message events

**Test**: Send a message to your WhatsApp number. Check Cloud Run logs to see if webhook is received.

#### SMS/USSD Webhook Setup (Africa's Talking)

1. Log in to [Africa's Talking Dashboard](https://account.africastalking.com/)
2. Go to "Services" > "SMS" > "Settings"
3. Under "Callback URL", enter:
   - `https://your-service-url.run.app/webhook/sms`
4. Save changes

**For USSD**:
1. Go to "Services" > "USSD"
2. Create a new USSD service
3. Set callback URL: `https://your-service-url.run.app/webhook/ussd`

#### Voice Webhook Setup (Twilio)

1. Log in to [Twilio Console](https://console.twilio.com/)
2. Go to "Phone Numbers" > "Manage" > "Active Numbers"
3. Click on your number
4. Under "Voice & Fax", set:
   - **Webhook URL**: `https://your-service-url.run.app/webhook/voice`
   - **HTTP Method**: POST
5. Save

**Note**: Ensure your Cloud Run service allows unauthenticated requests for webhooks to work.

## Testing

### Test WhatsApp
1. Send a message to your WhatsApp number
2. Verify webhook receives the message
3. Check response is sent back

### Test SMS
```bash
curl -X POST http://localhost:8080/webhook/sms \
  -H "Content-Type: application/json" \
  -d '{"from": "+254700000000", "text": "I need advice on growing maize"}'
```

### Test Web API
```bash
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+254700000000", "message": "What is the weather forecast?"}'
```

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: Genkit Initialization Errors

**Error**: `Failed to initialize Genkit`

**Solutions**:
1. Verify `GOOGLE_AI_API_KEY` is set:
   ```bash
   echo $GOOGLE_AI_API_KEY
   ```
2. Get API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
3. Check Vertex AI API is enabled:
   ```bash
   gcloud services list --enabled | grep aiplatform
   ```
4. Verify service account permissions:
   ```bash
   gcloud projects get-iam-policy YOUR_PROJECT_ID \
     --flatten="bindings[].members" \
     --filter="bindings.members:serviceAccount:YOUR_SERVICE_ACCOUNT"
   ```

#### Issue 2: Matching Engine Errors

**Error**: `Error querying Matching Engine` or `Index not found`

**Solutions**:
1. Verify index exists:
   ```bash
   gcloud ai indexes list --region=us-central1
   ```
2. Check index is deployed:
   ```bash
   gcloud ai index-endpoints list --region=us-central1
   ```
3. Verify IDs in .env match actual IDs
4. Wait for index deployment to complete (can take 30+ minutes)
5. Check index endpoint is in "READY" state

#### Issue 3: Service Account Authentication

**Error**: `Could not load the default credentials`

**Solutions**:
1. Verify path to service account JSON:
   ```bash
   ls -la $GOOGLE_APPLICATION_CREDENTIALS
   ```
2. Use absolute path in .env:
   ```env
   GOOGLE_APPLICATION_CREDENTIALS=/full/path/to/key.json
   ```
3. Set environment variable:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=./key.json
   ```

#### Issue 4: Channel Integration Issues

**WhatsApp not receiving messages**:
- Verify webhook URL is accessible (test with curl)
- Check webhook verification token matches
- Ensure Cloud Run service allows unauthenticated requests
- Check Cloud Run logs: `gcloud run services logs read shambasmart-ai`

**SMS not working**:
- Verify Africa's Talking API credentials
- Check account has sufficient balance
- Verify sender ID is approved
- Test API directly: `curl -X POST https://api.africastalking.com/...`

**Voice not working**:
- Verify Twilio credentials
- Check phone number is active
- Verify webhook URL is HTTPS (required by Twilio)
- Test TwiML response format

#### Issue 5: Port Already in Use

**Error**: `EADDRINUSE: address already in use :::8080`

**Solutions**:
```bash
# Find process using port
lsof -i :8080  # Mac/Linux
netstat -ano | findstr :8080  # Windows

# Kill process or change PORT in .env
PORT=3001 npm run dev
```

#### Issue 6: Build Errors

**TypeScript compilation errors**:
```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

**Missing dependencies**:
```bash
# Reinstall all dependencies
rm -rf node_modules package-lock.json
npm install
```

### Getting Help

1. **Check Logs**:
   ```bash
   # Local logs
   npm run dev  # Check console output
   
   # Cloud Run logs
   gcloud run services logs read shambasmart-ai --region us-central1
   ```

2. **Verify Environment**:
   ```bash
   # Check all environment variables are set
   cat .env | grep -v "^#" | grep -v "^$"
   ```

3. **Test Individual Components**:
   ```bash
   # Test health endpoint
   curl http://localhost:8080/health
   
   # Test API endpoint
   curl -X POST http://localhost:8080/api/chat \
     -H "Content-Type: application/json" \
     -d '{"phoneNumber": "+254700000000", "message": "test"}'
   ```

## Quick Start Checklist

Use this checklist to ensure you've completed all setup steps:

### Prerequisites
- [ ] GCP project created
- [ ] Required APIs enabled
- [ ] Service account created with proper roles
- [ ] Service account JSON key downloaded
- [ ] Matching Engine index created
- [ ] Matching Engine endpoint deployed
- [ ] Channel API credentials obtained (WhatsApp, Africa's Talking, Twilio)

### Installation
- [ ] Dependencies installed (`npm install`)
- [ ] Frontend dependencies installed (`cd frontend && npm install`)
- [ ] `.env` file created from `.env.example`
- [ ] All environment variables configured
- [ ] Service account file path verified

### Data Setup
- [ ] Project built (`npm run build`)
- [ ] Data ingestion completed (`npm run ingest`)
- [ ] Matching Engine index populated

### Testing
- [ ] Backend server runs (`npm run dev`)
- [ ] Health endpoint responds (`/health`)
- [ ] Frontend runs (`npm run dev:frontend`)
- [ ] Web API test successful
- [ ] At least one channel tested (WhatsApp/SMS/Web)

### Deployment (Optional)
- [ ] Cloud Run service deployed
- [ ] Environment variables set in Cloud Run
- [ ] Service URL obtained
- [ ] Webhooks configured for channels
- [ ] Production testing completed

## Next Steps

### Immediate Enhancements
1. **Add More Data Sources:**
   - Download KALRO publications from https://www.kalro.org/publications
   - Add MOA extension manuals
   - Include FAO datasets
   - Update `data/ingest.ts` to process new sources

2. **Improve RAG Pipeline:**
   - Fine-tune document chunking strategy
   - Add metadata filtering
   - Implement hybrid search (keyword + vector)

3. **Enhance Agents:**
   - Add more specialized agents (Soil Advisor, Irrigation Advisor)
   - Improve intent classification with ML
   - Implement agent collaboration workflows

### Infrastructure Improvements
1. **Set up Monitoring:**
   ```bash
   # Enable Cloud Monitoring
   gcloud services enable monitoring.googleapis.com
   ```
   - Add custom metrics
   - Set up alerting policies
   - Create dashboards

2. **Implement Caching:**
   - Add Redis for response caching
   - Cache weather forecasts
   - Cache market prices

3. **Set up Scheduled Jobs:**
   - Cloud Scheduler for alert checks
   - Daily data ingestion
   - Index updates

### User Experience
1. **Add Features:**
   - User onboarding flow
   - Conversation history UI
   - Voice input/output
   - Image upload for pest detection
   - Offline mode for PWA

2. **Multi-language:**
   - Add more local languages
   - Improve translation quality
   - Regional dialect support

### Production Readiness
1. **Security:**
   - Implement rate limiting
   - Add authentication for admin endpoints
   - Encrypt sensitive data
   - Set up WAF rules

2. **Performance:**
   - Optimize database queries
   - Implement CDN for static assets
   - Add load balancing
   - Set up auto-scaling policies

3. **Compliance:**
   - GDPR compliance for user data
   - Data retention policies
   - Privacy policy implementation

