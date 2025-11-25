import { Express, Request, Response } from 'express';
import { BaseChannel } from './base-channel';
import axios from 'axios';
import { logger } from '../utils/logger';

export class WhatsAppChannel extends BaseChannel {
  name = 'WhatsApp';
  private accessToken: string;
  private phoneNumberId: string;
  private verifyToken: string;

  constructor() {
    super();
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'shambasmart-verify';
  }

  setupRoutes(app: Express): void {
    // Webhook verification
    app.get('/webhook/whatsapp', (req: Request, res: Response) => {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (mode === 'subscribe' && token === this.verifyToken) {
        logger.info('WhatsApp webhook verified');
        res.status(200).send(challenge);
      } else {
        res.sendStatus(403);
      }
    });

    // Webhook handler
    app.post('/webhook/whatsapp', async (req: Request, res: Response) => {
      try {
        const body = req.body;
        
        if (body.object === 'whatsapp_business_account') {
          const entry = body.entry?.[0];
          const changes = entry?.changes?.[0];
          const value = changes?.value;
          
          if (value?.messages) {
            const message = value.messages[0];
            const from = message.from;
            const text = message.text?.body || '';
            
            if (text) {
              const response = await this.processMessage({
                channel: 'whatsapp',
                from,
                content: text,
                timestamp: new Date(),
              });
              
              await this.sendMessage(from, response);
            }
          }
        }
        
        res.sendStatus(200);
      } catch (error) {
        logger.error('Error handling WhatsApp webhook:', error);
        res.sendStatus(500);
      }
    });
  }

  async sendMessage(to: string, text: string): Promise<void> {
    try {
      const url = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;
      
      await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      logger.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }
}

export function setupWhatsAppRoutes(app: Express): void {
  const channel = new WhatsAppChannel();
  channel.setupRoutes(app);
}

