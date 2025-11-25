import { Express, Request, Response } from 'express';
import { BaseChannel } from './base-channel';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AfricasTalking = require('africastalking');
import { logger } from '../utils/logger';

export class SMSChannel extends BaseChannel {
  name = 'SMS';
  private atClient: any;
  private senderId: string;

  constructor() {
    super();
    const apiKey = process.env.AT_API_KEY || '';
    const username = process.env.AT_USERNAME || '';
    this.senderId = process.env.AT_SENDER_ID || 'SHAMBASMART';
    
    this.atClient = new AfricasTalking({
      apiKey,
      username,
    });
  }

  setupRoutes(app: Express): void {
    // Inbound SMS webhook
    app.post('/webhook/sms', async (req: Request, res: Response) => {
      try {
        const { from, text } = req.body;
        
        if (from && text) {
          const response = await this.processMessage({
            channel: 'sms',
            from,
            content: text,
            timestamp: new Date(),
          });
          
          await this.sendMessage(from, response);
        }
        
        res.sendStatus(200);
      } catch (error) {
        logger.error('Error handling SMS webhook:', error);
        res.sendStatus(500);
      }
    });
  }

  async sendMessage(to: string, text: string): Promise<void> {
    try {
      const sms = this.atClient.SMS;
      
      await sms.send({
        to,
        message: text,
        from: this.senderId,
      });
    } catch (error) {
      logger.error('Error sending SMS:', error);
      throw error;
    }
  }
}

export function setupSMSRoutes(app: Express): void {
  const channel = new SMSChannel();
  channel.setupRoutes(app);
}

