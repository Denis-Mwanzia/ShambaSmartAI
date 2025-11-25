// Temporary fix for web channel return type issues
import { Express, Request, Response } from 'express';
import { BaseChannel } from './base-channel';
import { databaseService } from '../services/database';
import { logger } from '../utils/logger';

export class WebChannel extends BaseChannel {
  name = 'Web';
  
  setupRoutes(app: Express): void {
    // API endpoint for web frontend
    app.post('/api/chat', async (req: Request, res: Response): Promise<void> => {
      try {
        const { phoneNumber, message, language } = req.body;
        
        if (!phoneNumber || !message) {
          res.status(400).json({ error: 'phoneNumber and message are required' });
          return;
        }
        
        const response = await this.processMessage({
          channel: 'web',
          from: phoneNumber,
          content: message,
          timestamp: new Date(),
          metadata: { language: language || 'en' },
        });
        
        res.json({ response });
      } catch (error) {
        logger.error('Error handling web chat:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    
    // Get chat history
    app.get('/api/chat/history', async (req: Request, res: Response): Promise<void> => {
      try {
        const { phoneNumber } = req.query;
        
        if (!phoneNumber) {
          res.status(400).json({ error: 'phoneNumber is required' });
          return;
        }
        
        const user = await databaseService.getUser(phoneNumber as string);
        if (!user) {
          res.json({ messages: [] });
          return;
        }
        
        const messages = await databaseService.getMessages(user.id, 50);
        res.json({ messages });
      } catch (error) {
        logger.error('Error getting chat history:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Update user location
    app.post('/api/user/location', async (req: Request, res: Response): Promise<void> => {
      try {
        const { phoneNumber, latitude, longitude } = req.body;
        
        if (!phoneNumber || latitude === undefined || longitude === undefined) {
          res.status(400).json({ error: 'phoneNumber, latitude, and longitude are required' });
          return;
        }
        
        const user = await databaseService.getUser(phoneNumber);
        if (!user) {
          res.status(404).json({ error: 'User not found' });
          return;
        }

        // Get county from coordinates
        const { locationService } = await import('../services/location');
        const county = await locationService.getCountyFromCoordinates(latitude, longitude);

        // Update user with location
        await databaseService.updateUser(user.id, {
          latitude,
          longitude,
          county: county || undefined,
          locationUpdatedAt: new Date(),
        });

        res.json({ 
          success: true, 
          county: county || 'Unknown',
          message: 'Location updated successfully' 
        });
      } catch (error) {
        logger.error('Error updating user location:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }
}

export function setupWebRoutes(app: Express): void {
  const channel = new WebChannel();
  channel.setupRoutes(app);
}
