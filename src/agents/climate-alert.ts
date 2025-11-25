import { BaseAgent } from './base-agent';
import { UserContext } from '../models/user';
import { generateText } from '../utils/genkit-helper';
import { logger } from '../utils/logger';
import { weatherService } from '../services/weather';
import { climateAlertSystemInstructions } from './system-instructions';

export class ClimateAlertAgent extends BaseAgent {
  name = 'Climate Alert';
  description = 'Provides weather forecasts and climate alerts';
  
  protected async generateResponse(
    query: string,
    context: UserContext,
    relevantDocs: string[],
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    try {
      const region = context.region || context.user.county || 'Nairobi';
      const locationContext = context.coordinates 
        ? `User's exact location: ${context.coordinates.lat}, ${context.coordinates.lon}`
        : context.user.county
        ? `User's county: ${context.user.county}, Kenya`
        : `Region: ${region}, Kenya`;
      
      // Get real-time weather data
      const weatherData = await weatherService.getForecast(region);
      
      const prompt = `FARMER CONTEXT:
- Location: ${locationContext}
- Region/County: ${region}

CURRENT WEATHER DATA:
${JSON.stringify(weatherData, null, 2)}

RELEVANT KNOWLEDGE BASE:
${relevantDocs.length > 0 ? relevantDocs.join('\n\n') : 'General agricultural knowledge'}

FARMER'S QUESTION: "${query}"

${conversationHistory && conversationHistory.length > 0 ? `CONVERSATION CONTEXT:
${conversationHistory.slice(-3).map(msg => `${msg.role === 'user' ? 'Farmer' : 'You'}: ${msg.content}`).join('\n')}

Use this context to understand if this is a follow-up about weather or farming timing.

` : ''}INSTRUCTIONS:
1. Analyze the weather data and provide specific, location-based forecasts
2. Give practical farming recommendations based on current and forecasted weather
3. Highlight any alerts for extreme conditions (drought, floods, heat stress, frost)
4. Provide seasonal planting/harvesting advice specific to ${region}
5. Include actionable steps the farmer can take to protect their crops/livestock
6. Use Kenyan agricultural context and terminology
7. Be specific about timing and conditions
8. If this is a follow-up, reference previous weather discussions and provide updated or additional information

IMPORTANT: Provide a direct response without repeating the question or using "Question:" or "Answer:" labels. Just give the advice directly.

Format your response with:
- Current weather conditions
- Forecast for the coming days/weeks
- Farming recommendations based on weather
- Alerts for extreme conditions
- Seasonal advice

Respond in ${context.user.preferredLanguage === 'sw' ? 'Kiswahili' : 'English'} with clear, well-structured advice.`;

      // Disable cache if conversation history exists (conversational context)
      const useCache = !conversationHistory || conversationHistory.length === 0;
      const response = await generateText(
        prompt, 
        'gemini-2.0-flash-exp', 
        useCache, 
        climateAlertSystemInstructions,
        0.2
      );
      return response;
    } catch (error) {
      logger.error('Error in climate alert agent:', error);
      return 'I apologize, but I encountered an error getting weather information. Please try again later.';
    }
  }
}

export const climateAlertAgent = new ClimateAlertAgent();

