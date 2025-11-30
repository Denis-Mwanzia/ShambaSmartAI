import { Express, Request, Response } from 'express';
import { BaseChannel } from './base-channel';
import { logger } from '../utils/logger';
import { webhookRateLimiter } from '../middleware/rate-limiter';

export class USSDChannel extends BaseChannel {
  name = 'USSD';
  
  setupRoutes(app: Express): void {
    // USSD session handler (with webhook rate limiting)
    app.post('/webhook/ussd', webhookRateLimiter, async (req: Request, res: Response) => {
      try {
        const { phoneNumber, text, sessionId } = req.body;
        
        // USSD uses a session-based flow
        let responseText = '';
        
        if (!text || text === '') {
          // Initial menu
          responseText = `CON Welcome to ShambaSmart AI\n
1. Crop Advice
2. Livestock Health
3. Pest & Disease
4. Weather Forecast
5. Market Prices
0. Exit

Enter your choice:`;
        } else {
          // Process user input
          const input = text.split('*').pop() || '';
          
          if (input === '0') {
            responseText = 'END Thank you for using ShambaSmart AI!';
          } else {
            // Get user's question based on menu selection
            const question = this.getQuestionFromMenu(input);
            
            if (question) {
              const response = await this.processMessage({
                channel: 'ussd',
                from: phoneNumber,
                content: question,
                timestamp: new Date(),
                metadata: { sessionId, menuInput: input },
              });
              
              // Format response for USSD (max 160 chars per screen)
              responseText = `CON ${this.formatForUSSD(response)}\n\n0. Back to Menu`;
            } else {
              responseText = 'CON Invalid selection. Please try again.\n\n0. Back to Menu';
            }
          }
        }
        
        res.set('Content-Type', 'text/plain');
        res.send(responseText);
      } catch (error) {
        logger.error('Error handling USSD request:', error);
        res.send('END Sorry, an error occurred. Please try again later.');
      }
    });
  }
  
  private getQuestionFromMenu(input: string): string | null {
    const menuMap: Record<string, string> = {
      '1': 'I need crop advice',
      '2': 'I need livestock health information',
      '3': 'I have a pest or disease problem',
      '4': 'What is the weather forecast?',
      '5': 'What are the current market prices?',
    };
    
    return menuMap[input] || null;
  }
  
  private formatForUSSD(text: string): string {
    // USSD has limitations - truncate and format
    const maxLength = 150;
    if (text.length <= maxLength) return text;
    
    return text.substring(0, maxLength - 3) + '...';
  }
}

export function setupUSSDRoutes(app: Express): void {
  const channel = new USSDChannel();
  channel.setupRoutes(app);
}

