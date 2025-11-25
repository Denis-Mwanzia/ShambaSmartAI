import { Express, Request, Response } from 'express';
import { BaseChannel } from './base-channel';
import twilio from 'twilio';
import { logger } from '../utils/logger';

export class VoiceChannel extends BaseChannel {
  name = 'Voice';
  
  constructor() {
    super();
  }
  
  setupRoutes(app: Express): void {
    // Twilio voice webhook
    app.post('/webhook/voice', async (req: Request, res: Response) => {
      try {
        const { From, CallSid, SpeechResult } = req.body;
        
        // Twilio voice uses TwiML for responses
        const twiml = new twilio.twiml.VoiceResponse();
        
        if (SpeechResult) {
          // Process voice input
          const response = await this.processMessage({
            channel: 'voice',
            from: From,
            content: SpeechResult,
            timestamp: new Date(),
            metadata: { callSid: CallSid },
          });
          
          // Convert text to speech
          twiml.say({ voice: 'alice', language: 'en' as any }, response);
          twiml.pause({ length: 1 });
          twiml.say({ voice: 'alice', language: 'en' as any }, 'Thank you for calling ShambaSmart AI. Goodbye.');
        } else {
          // Initial greeting
          twiml.gather({
            input: ['speech'],
            language: 'en' as any,
            speechTimeout: 'auto',
            action: '/webhook/voice',
            method: 'POST',
          }).say({ voice: 'alice', language: 'en' as any }, 
            'Welcome to ShambaSmart AI. Please tell me your farming question.');
        }
        
        res.type('text/xml');
        res.send(twiml.toString());
      } catch (error) {
        logger.error('Error handling voice webhook:', error);
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say({ voice: 'alice', language: 'en' as any }, 
          'Sorry, an error occurred. Please try again later.');
        res.type('text/xml');
        res.send(twiml.toString());
      }
    });
  }
}

export function setupVoiceRoutes(app: Express): void {
  const channel = new VoiceChannel();
  channel.setupRoutes(app);
}

