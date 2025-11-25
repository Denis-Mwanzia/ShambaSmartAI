import { configureGenkit } from '@genkit-ai/core';
import { googleAI } from '@genkit-ai/googleai';
import { logger } from '../utils/logger';

export function initializeGenkit() {
  try {
    configureGenkit({
      plugins: [
        googleAI({
          apiKey: process.env.GOOGLE_AI_API_KEY,
        }),
      ],
      logLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      enableTracingAndMetrics: true,
    });
    logger.info('Genkit initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Genkit:', error);
    // Don't throw in development - allow app to continue
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }
}

