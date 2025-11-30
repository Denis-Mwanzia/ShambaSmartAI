import { Express, Request, Response } from 'express';
import { BaseChannel } from './base-channel';
import twilio from 'twilio';
import { logger } from '../utils/logger';
import { databaseService } from '../services/database';
import { webhookRateLimiter } from '../middleware/rate-limiter';

export class VoiceChannel extends BaseChannel {
  name = 'Voice';
  
  constructor() {
    super();
  }
  
  setupRoutes(app: Express): void {
    // Twilio voice webhook (with webhook rate limiting)
    app.post('/webhook/voice', webhookRateLimiter, async (req: Request, res: Response) => {
      try {
        const { From, CallSid, SpeechResult, CallStatus, Digits } = req.body;
        
        // Twilio voice uses TwiML for responses
        const twiml = new twilio.twiml.VoiceResponse();
        
        // Get user to determine language preference
        let user = null;
        let preferredLanguage = 'en';
        if (From) {
          user = await databaseService.getUser(From);
          if (user) {
            preferredLanguage = user.preferredLanguage || 'en';
          }
        }
        
        // Determine language for TTS (Swahili or English)
        const ttsLanguage = preferredLanguage === 'sw' ? 'sw-KE' : 'en-US';
        const ttsVoice = preferredLanguage === 'sw' ? 'alice' : 'alice'; // Twilio supports alice for both
        
        // Handle call status
        if (CallStatus === 'ringing' || CallStatus === 'initiated') {
          // Initial greeting with language selection
          const greeting = preferredLanguage === 'sw' 
            ? 'Karibu ShambaSmart AI. Tafadhali sema swali lako la kilimo.'
            : 'Welcome to ShambaSmart AI. Please tell me your farming question.';
          
          twiml.gather({
            input: ['speech'],
            language: preferredLanguage === 'sw' ? 'sw-KE' : 'en-US',
            speechTimeout: 'auto',
            action: '/webhook/voice',
            method: 'POST',
            hints: preferredLanguage === 'sw'
              ? 'mahindi, mazao, mifugo, wadudu, hali ya hewa, bei'
              : 'maize, crops, livestock, pests, weather, price',
            enhanced: true,
            speechModel: 'phone_call', // Better for phone calls
          }).say({ voice: ttsVoice, language: ttsLanguage as any }, greeting);
          
          // Timeout handler
          twiml.say({ voice: ttsVoice, language: ttsLanguage as any },
            preferredLanguage === 'sw' 
              ? 'Samahani, sikuweza kusikia. Tafadhali jaribu tena.'
              : 'Sorry, I could not hear you. Please try again.'
          );
        } else if (SpeechResult) {
          // Process voice input (Speech-to-Text result)
          logger.info(`Voice input received: ${SpeechResult} from ${From}`);
          
          // Process the message
          const response = await this.processMessage({
            channel: 'voice',
            from: From,
            content: SpeechResult,
            timestamp: new Date(),
            metadata: { 
              callSid: CallSid,
              language: preferredLanguage,
            },
          });
          
          // Truncate response if too long for TTS (max ~1500 chars for Twilio)
          const maxTTSLength = 1500;
          let ttsResponse = response;
          if (response.length > maxTTSLength) {
            ttsResponse = response.substring(0, maxTTSLength) + 
              (preferredLanguage === 'sw' ? '... Tafadhali endelea kusoma kwenye simu yako.' : '... Please continue reading on your phone.');
          }
          
          // Convert text to speech with natural pauses
          twiml.say({ 
            voice: ttsVoice, 
            language: ttsLanguage as any,
          }, ttsResponse);
          
          // Ask if user wants to continue
          twiml.pause({ length: 1 });
          const continuePrompt = preferredLanguage === 'sw'
            ? 'Je, una swali jingine? Sema ndiyo au la.'
            : 'Do you have another question? Say yes or no.';
          
          twiml.gather({
            input: ['speech', 'dtmf'],
            language: preferredLanguage === 'sw' ? 'sw-KE' : 'en-US',
            speechTimeout: 'auto',
            action: '/webhook/voice',
            method: 'POST',
            numDigits: 1,
            timeout: 5,
          }).say({ voice: ttsVoice, language: ttsLanguage as any }, continuePrompt);
          
          // Timeout - end call
          twiml.say({ voice: ttsVoice, language: ttsLanguage as any },
            preferredLanguage === 'sw'
              ? 'Asante kwa kutumia ShambaSmart AI. Kwaheri.'
              : 'Thank you for using ShambaSmart AI. Goodbye.'
          );
          twiml.hangup();
        } else if (Digits) {
          // Handle DTMF input (1 for yes, 2 for no)
          if (Digits === '1' || Digits === '9') {
            // Continue with another question
            const prompt = preferredLanguage === 'sw'
              ? 'Tafadhali sema swali lako.'
              : 'Please tell me your question.';
            
            twiml.gather({
              input: ['speech'],
              language: preferredLanguage === 'sw' ? 'sw-KE' : 'en-US',
              speechTimeout: 'auto',
              action: '/webhook/voice',
              method: 'POST',
              enhanced: true,
              speechModel: 'phone_call',
            }).say({ voice: ttsVoice, language: ttsLanguage as any }, prompt);
          } else {
            // End call
            twiml.say({ voice: ttsVoice, language: ttsLanguage as any },
              preferredLanguage === 'sw'
                ? 'Asante kwa kutumia ShambaSmart AI. Kwaheri.'
                : 'Thank you for using ShambaSmart AI. Goodbye.'
            );
            twiml.hangup();
          }
        } else {
          // No input - ask again
          const retryPrompt = preferredLanguage === 'sw'
            ? 'Samahani, sikuweza kusikia. Tafadhali sema swali lako tena.'
            : 'Sorry, I could not hear you. Please tell me your question again.';
          
          twiml.gather({
            input: ['speech'],
            language: preferredLanguage === 'sw' ? 'sw-KE' : 'en-US',
            speechTimeout: 'auto',
            action: '/webhook/voice',
            method: 'POST',
            enhanced: true,
            speechModel: 'phone_call',
          }).say({ voice: ttsVoice, language: ttsLanguage as any }, retryPrompt);
        }
        
        res.type('text/xml');
        res.send(twiml.toString());
      } catch (error) {
        logger.error('Error handling voice webhook:', error);
        const twiml = new twilio.twiml.VoiceResponse();
        const errorMessage = 'Sorry, an error occurred. Please try again later.';
        twiml.say({ voice: 'alice', language: 'en-US' as any }, errorMessage);
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

