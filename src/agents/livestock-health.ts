import { BaseAgent } from './base-agent';
import { UserContext } from '../models/user';
import { generateText } from '../utils/genkit-helper';
import { logger } from '../utils/logger';
import { dataSourceService } from '../services/data-source';
import { livestockHealthSystemInstructions } from './system-instructions';

export class LivestockHealthAgent extends BaseAgent {
  name = 'Livestock Health';
  description = 'Provides livestock health and management advice';
  
  protected async generateResponse(
    query: string,
    context: UserContext,
    relevantDocs: string[],
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    try {
      const livestock = context.user.livestock.join(', ') || 'livestock';
      const region = context.region || context.user.county || 'Kenya';
      
      // Get livestock disease data directly from data sources
      const diseaseData = dataSourceService.searchLivestockDiseases(query, livestock);
      const diseaseInfo = diseaseData.length > 0 
        ? dataSourceService.formatLivestockDiseaseData(diseaseData)
        : '';

      const locationContext = context.coordinates 
        ? `User's exact location: ${context.coordinates.lat}, ${context.coordinates.lon}`
        : context.user.county
        ? `User's county: ${context.user.county}, Kenya`
        : `Region: ${region}, Kenya`;

      const prompt = `FARMER CONTEXT:
- Livestock Type: ${livestock}
- Location: ${locationContext}
- Region: ${region}

LIVESTOCK DISEASE DATABASE:
${diseaseInfo ? `${diseaseInfo}\n\n` : 'No specific disease data found in database - use general knowledge'}

ADDITIONAL KNOWLEDGE BASE:
${relevantDocs.length > 0 ? relevantDocs.join('\n\n') : 'General livestock health knowledge'}

FARMER'S QUESTION: "${query}"

${conversationHistory && conversationHistory.length > 0 ? `CONVERSATION CONTEXT:
${conversationHistory.slice(-3).map(msg => `${msg.role === 'user' ? 'Farmer' : 'You'}: ${msg.content}`).join('\n')}

Use this context to understand if this is a follow-up about a previously discussed livestock issue.

` : ''}INSTRUCTIONS:
1. Analyze the question carefully - if it references previous conversation, use that context
2. If the disease matches the database, reference it directly and use the specific treatment methods provided
3. Provide practical, actionable advice including:
   - Disease identification and symptoms
   - Treatment options (prefer cost-effective and accessible methods)
   - Prevention strategies
   - Feeding and nutrition recommendations
   - Management practices specific to ${region}
   - When to consult a veterinary officer
4. Consider the local context and available resources in ${region}
5. Include specific dosages, timing, and safety precautions
6. Be empathetic and supportive
7. If this is a follow-up, reference what was discussed before and provide additional or clarifying information

IMPORTANT: Provide a direct response without repeating the question or using "Question:" or "Answer:" labels. Just give the advice directly.

Format your response with:
- Disease/issue identification
- Treatment options
- Prevention strategies
- Feeding and nutrition advice
- Management practices
- When to consult a vet

Respond in ${context.user.preferredLanguage === 'sw' ? 'Kiswahili' : 'English'} with clear, well-structured advice.`;

      // Disable cache if conversation history exists (conversational context)
      const useCache = !conversationHistory || conversationHistory.length === 0;
      const response = await generateText(
        prompt, 
        'gemini-2.0-flash-exp', 
        useCache, 
        livestockHealthSystemInstructions,
        0.2
      );
      return response;
    } catch (error) {
      logger.error('Error in livestock health agent:', error);
      return 'I apologize, but I encountered an error processing your livestock question. Please try rephrasing or contact a veterinary officer.';
    }
  }
}

export const livestockHealthAgent = new LivestockHealthAgent();

