import { BaseAgent } from './base-agent';
import { UserContext } from '../models/user';
import { generateText } from '../utils/genkit-helper';
import { logger } from '../utils/logger';
import { dataSourceService } from '../services/data-source';
import { pestDetectionSystemInstructions } from './system-instructions';

export class PestDetectionAgent extends BaseAgent {
  name = 'Pest & Disease Detection';
  description = 'Identifies pests and diseases and provides control recommendations';
  
  protected async generateResponse(
    query: string,
    context: UserContext,
    relevantDocs: string[],
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    try {
      const crop = context.crop || context.user.crops[0] || 'crops';
      const region = context.region || context.user.county || 'Kenya';
      
      // Get pest data directly from data sources
      const pestData = dataSourceService.searchPests(query, crop);
      const pestInfo = pestData.length > 0 
        ? dataSourceService.formatPestData(pestData)
        : '';

      const locationContext = context.coordinates 
        ? `User's exact location: ${context.coordinates.lat}, ${context.coordinates.lon}`
        : context.user.county
        ? `User's county: ${context.user.county}, Kenya`
        : `Region: ${region}, Kenya`;

      const prompt = `FARMER CONTEXT:
- Crop: ${crop}
- Location: ${locationContext}
- Region: ${region}

PEST DATABASE:
${pestInfo ? `${pestInfo}\n\n` : 'No specific pest data found in database - use general knowledge'}

ADDITIONAL KNOWLEDGE BASE:
${relevantDocs.length > 0 ? relevantDocs.join('\n\n') : 'General pest and disease knowledge'}

FARMER'S QUESTION/DESCRIPTION: "${query}"

${conversationHistory && conversationHistory.length > 0 ? `CONVERSATION CONTEXT:
${conversationHistory.slice(-3).map(msg => `${msg.role === 'user' ? 'Farmer' : 'You'}: ${msg.content}`).join('\n')}

Use this context to understand if this is a follow-up about a previously discussed pest/disease issue.

` : ''}INSTRUCTIONS:
1. Carefully analyze the farmer's description - if it references previous conversation, use that context
2. If the pest/disease matches the database, reference it directly and use the specific control methods provided
3. If symptoms are unclear, provide likely possibilities based on the crop and region
4. Provide recommended control measures prioritizing:
   - Organic and Integrated Pest Management (IPM) methods
   - Cost-effective solutions
   - Methods suitable for ${region}
   - Safe application practices
5. Include prevention strategies to avoid future outbreaks
6. Provide specific product recommendations if appropriate (with safety warnings)
7. Include timing for treatment application
8. Be empathetic and supportive
9. If this is a follow-up, reference what was discussed before and provide additional or clarifying information

IMPORTANT: Provide a direct response without repeating the question or using "Question:" or "Answer:" labels. Just give the advice directly.

Format your response with:
- Clear identification of the pest/disease
- Symptoms confirmation
- Control measures (prioritize organic/IPM)
- Prevention strategies
- Specific recommendations

Respond in ${context.user.preferredLanguage === 'sw' ? 'Kiswahili' : 'English'} with clear, actionable advice.`;

      // Disable cache if conversation history exists (conversational context)
      const useCache = !conversationHistory || conversationHistory.length === 0;
      const response = await generateText(
        prompt, 
        'gemini-2.0-flash-exp', 
        useCache, 
        pestDetectionSystemInstructions,
        0.2
      );
      return response;
    } catch (error) {
      logger.error('Error in pest detection agent:', error);
      return 'I apologize, but I encountered an error processing your pest/disease question. Please describe the symptoms in more detail or contact an extension officer.';
    }
  }
}

export const pestDetectionAgent = new PestDetectionAgent();

