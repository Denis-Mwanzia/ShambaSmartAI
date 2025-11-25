import { Express } from 'express';
import { IncomingMessage } from '../models/message';
import { UserContext } from '../models/user';
import { agentOrchestrator } from '../agents/orchestrator';
import { databaseService } from '../services/database';
import { logger } from '../utils/logger';

export abstract class BaseChannel {
  abstract name: string;
  
  abstract setupRoutes(app: Express): void;
  
  protected async processMessage(message: IncomingMessage): Promise<string> {
    try {
      // Get or create user
      let user = await databaseService.getUser(message.from);
      if (!user) {
        user = await databaseService.createUser({
          phoneNumber: message.from,
          preferredLanguage: 'en',
          crops: [],
          livestock: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      
      // Save incoming message
      const messageData: any = {
        userId: user.id,
        channel: message.channel,
        content: message.content,
        direction: 'inbound',
        timestamp: new Date(),
      };
      if (message.metadata && Object.keys(message.metadata).length > 0) {
        messageData.metadata = message.metadata;
      }
      await databaseService.saveMessage(messageData);
      
      // Extract context from message
      const context = await this.extractContext(message, user);
      
      // Get recent conversation history for context (last 6 messages)
      const recentMessages = await databaseService.getMessages(user.id, 6);
      const conversationHistory = recentMessages
        .sort((a, b) => {
          // Handle different timestamp formats
          const getTimestamp = (ts: any): number => {
            if (ts instanceof Date) return ts.getTime();
            if (typeof ts === 'object' && ts !== null) {
              const seconds = (ts as any).seconds || (ts as any)._seconds;
              if (seconds) return seconds * 1000;
            }
            if (typeof ts === 'string') return new Date(ts).getTime();
            if (typeof ts === 'number') return ts > 1000000000000 ? ts : ts * 1000;
            return Date.now();
          };
          return getTimestamp(a.timestamp) - getTimestamp(b.timestamp); // Sort ascending (oldest first)
        })
        .slice(0, -1) // Exclude current message
        .map(msg => ({
          role: msg.direction === 'inbound' ? 'user' as const : 'assistant' as const,
          content: msg.content,
        }));
      
      // Process with agent orchestrator (with conversation history)
      const response = await agentOrchestrator.processQuery(message.content, context, conversationHistory);
      
      // Save outgoing message
      await databaseService.saveMessage({
        userId: user.id,
        channel: message.channel,
        content: response,
        direction: 'outbound',
        timestamp: new Date(),
      });
      
      return response;
    } catch (error) {
      logger.error(`Error processing ${this.name} message:`, error);
      return 'Sorry, I encountered an error. Please try again.';
    }
  }
  
  protected async extractContext(
    message: IncomingMessage,
    user: any
  ): Promise<UserContext> {
    // Basic context extraction - can be enhanced with NLP
    const content = message.content.toLowerCase();
    
    // Extract crop mentions
    const crops = ['maize', 'wheat', 'rice', 'beans', 'potatoes', 'tomatoes', 'coffee', 'tea', 'sorghum', 'millet', 'cassava', 'sweet potato'];
    const mentionedCrop = crops.find(crop => content.includes(crop));
    
    // Extract region/county mentions
    const counties = ['nairobi', 'mombasa', 'kisumu', 'nakuru', 'eldoret', 'thika', 'nyeri', 'meru', 'embu', 'machakos', 'kakamega', 'bungoma'];
    const mentionedRegion = counties.find(county => content.includes(county));
    
    // Extract farm stage
    let farmStage: UserContext['farmStage'];
    if (content.includes('plant') || content.includes('planting')) farmStage = 'planting';
    else if (content.includes('grow') || content.includes('growing')) farmStage = 'growing';
    else if (content.includes('harvest')) farmStage = 'harvesting';
    else if (content.includes('post-harvest') || content.includes('storage')) farmStage = 'post-harvest';
    
    // Include coordinates if available
    const coordinates = user.latitude && user.longitude 
      ? { lat: user.latitude, lon: user.longitude }
      : undefined;
    
    return {
      user,
      crop: mentionedCrop,
      region: mentionedRegion || user.county?.toLowerCase(),
      soilType: user.soilType,
      farmStage,
      coordinates,
    };
  }
}

