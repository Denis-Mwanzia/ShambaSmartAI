import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeGenkit } from './genkit/config';
import { setupWhatsAppRoutes } from './channels/whatsapp';
import { setupSMSRoutes } from './channels/sms';
import { setupUSSDRoutes } from './channels/ussd';
import { setupVoiceRoutes } from './channels/voice';
import { setupWebRoutes } from './channels/web';
import { logger } from './utils/logger';
import { dataSourceService } from './services/data-source';
import { startAlertScheduler } from './services/alerts';
import { apiRateLimiter } from './middleware/rate-limiter';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply general API rate limiting
app.use(apiRateLimiter);

// Initialize Genkit
initializeGenkit();

// Initialize data sources
dataSourceService.initialize().catch((error) => {
  logger.error('Failed to initialize data sources:', error);
});

// Start alert scheduler (checks alerts every hour)
if (process.env.ENABLE_ALERTS !== 'false') {
  startAlertScheduler();
  logger.info('Alert scheduler started');
}

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ShambaSmart AI' });
});

// Channel routes
setupWhatsAppRoutes(app);
setupSMSRoutes(app);
setupUSSDRoutes(app);
setupVoiceRoutes(app);
setupWebRoutes(app);

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`ShambaSmart AI server running on port ${PORT}`);
});

export default app;

