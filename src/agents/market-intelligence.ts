import { BaseAgent } from './base-agent';
import { UserContext } from '../models/user';
import { generateText } from '../utils/genkit-helper';
import { logger } from '../utils/logger';
import { marketService } from '../services/market';
import { faostatService } from '../services/faostat';
import { marketIntelligenceSystemInstructions } from './system-instructions';

export class MarketIntelligenceAgent extends BaseAgent {
  name = 'Market Intelligence';
  description = 'Provides market prices and trading information';
  
  protected async generateResponse(
    query: string,
    context: UserContext,
    relevantDocs: string[],
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    try {
      const crop = context.crop || context.user.crops[0];
      const region = context.region || context.user.county || 'Kenya';
      
      // Get market prices from local service
      const marketData = crop ? await marketService.getPrices(crop, region) : null;
      
      // Get FAOSTAT agricultural statistics
      let faostatData = '';
      try {
        const cropProduction = await faostatService.getCropProduction(crop);
        const cropYield = await faostatService.getCropYield(crop);
        const marketPrices = await faostatService.getMarketPrices(crop);
        
        const allData = [...cropProduction, ...cropYield, ...marketPrices];
        if (allData.length > 0) {
          faostatData = faostatService.formatForPrompt(allData);
        }
      } catch (error) {
        logger.warn('Could not fetch FAOSTAT data:', error);
      }

      const locationContext = context.coordinates 
        ? `User's exact location: ${context.coordinates.lat}, ${context.coordinates.lon}`
        : context.user.county
        ? `User's county: ${context.user.county}, Kenya`
        : `Region: ${region}, Kenya`;
      
      const prompt = `FARMER CONTEXT:
- Location: ${locationContext}
- Crop/Product: ${crop || 'general agricultural products'}
- Region: ${region}

MARKET DATA:
${marketData ? JSON.stringify(marketData, null, 2) : 'Market data not available - use general knowledge'}

${faostatData ? `FAOSTAT AGRICULTURAL STATISTICS:\n${faostatData}\n\n` : ''}
RELEVANT KNOWLEDGE BASE:
${relevantDocs.length > 0 ? relevantDocs.join('\n\n') : 'General market knowledge'}

FARMER'S QUESTION: "${query}"

${conversationHistory && conversationHistory.length > 0 ? `CONVERSATION CONTEXT:
${conversationHistory.slice(-3).map(msg => `${msg.role === 'user' ? 'Farmer' : 'You'}: ${msg.content}`).join('\n')}

Use this context to understand if this is a follow-up about market prices or selling strategies.

` : ''}INSTRUCTIONS:
1. Provide current market prices if available, or general price ranges for ${crop || 'the product'} in ${region}
2. Analyze price trends and provide forecasts
3. Recommend the best markets to sell in ${region} or nearby areas
4. Suggest optimal timing for selling based on market cycles
5. Provide value addition opportunities to increase income
6. Include practical advice on market access, transportation, and negotiation
7. Use Kenyan market context (KES prices, local markets, etc.)
8. Be specific and actionable
9. If this is a follow-up, reference previous market discussions and provide updated or additional information

IMPORTANT: Provide a direct response without repeating the question or using "Question:" or "Answer:" labels. Just give the advice directly.

Format your response with:
- Current market prices
- Price trends and forecasts
- Best markets to sell
- Optimal timing for selling
- Value addition opportunities
- Practical trading advice

Respond in ${context.user.preferredLanguage === 'sw' ? 'Kiswahili' : 'English'} with clear, well-structured advice.`;

      // Disable cache if conversation history exists (conversational context)
      const useCache = !conversationHistory || conversationHistory.length === 0;
      const response = await generateText(
        prompt, 
        'gemini-2.0-flash-exp', 
        useCache, 
        marketIntelligenceSystemInstructions,
        0.2
      );
      return response;
    } catch (error) {
      logger.error('Error in market intelligence agent:', error);
      return 'I apologize, but I encountered an error getting market information. Please try again later.';
    }
  }
}

export const marketIntelligenceAgent = new MarketIntelligenceAgent();
