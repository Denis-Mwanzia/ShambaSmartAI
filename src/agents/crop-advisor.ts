import { BaseAgent } from './base-agent';
import { UserContext } from '../models/user';
import { generateText } from '../utils/genkit-helper';
import { logger } from '../utils/logger';
import { dataSourceService } from '../services/data-source';
import { soilService } from '../services/soil';
import { cropAdvisorSystemInstructions } from './system-instructions';
import { QueryAnalyzer } from '../utils/query-analyzer';

export class CropAdvisorAgent extends BaseAgent {
  name = 'Crop Advisor';
  description = 'Provides crop-specific agricultural advice';
  
  protected async generateResponse(
    query: string,
    context: UserContext,
    relevantDocs: string[],
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    queryAnalysis?: ReturnType<typeof QueryAnalyzer.analyze>
  ): Promise<string> {
    try {
      const crop = context.crop || context.user.crops[0] || 'general crops';
      const region = context.region || context.user.county || 'Kenya';
      const soilType = context.soilType || context.user.soilType || 'unknown';
      
      // Get planting calendar and soil tips from data sources
      const plantingCalendar = dataSourceService.getPlantingCalendar(region);
      const calendarInfo = plantingCalendar 
        ? dataSourceService.formatPlantingCalendar(plantingCalendar)
        : '';
      
      const soilTips = dataSourceService.getSoilTips();
      const soilInfo = soilTips.length > 0 
        ? dataSourceService.formatSoilTips(soilTips)
        : '';

      // Get real-time soil data from ISRIC SoilGrids API (with timeout)
      let soilDataInfo = '';
      if (queryAnalysis?.complexity !== 'simple' || queryAnalysis?.requiresDetail) {
        try {
          // Use coordinates if available for more accurate soil data
          const coordinates = context.coordinates || 
            (context.user.latitude && context.user.longitude 
              ? { lat: context.user.latitude, lon: context.user.longitude }
              : undefined);
          
          // Add timeout to prevent hanging
          const soilPromise = soilService.getSoilProperties(region, coordinates);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Soil data fetch timeout')), 5000)
          );
          
          const soilProperties = await Promise.race([soilPromise, timeoutPromise]) as any;
          const recommendations = soilService.getRecommendations(soilProperties, crop);
          soilDataInfo = soilService.formatForPrompt(soilProperties, recommendations);
        } catch (error) {
          logger.warn('Could not fetch soil data from ISRIC, using local data only:', error);
          // Continue without soil data - not critical
        }
      }

      // Build location context
      const locationContext = context.coordinates 
        ? `User's exact location: ${context.coordinates.lat}, ${context.coordinates.lon}`
        : context.user.county
        ? `User's county: ${context.user.county}, Kenya`
        : 'Location: Kenya (general)';

      // Build the query prompt (system instructions are handled separately)
      const prompt = `FARMER CONTEXT:
- Crop: ${crop}
- Location: ${locationContext}
- Region/County: ${region}
- Soil Type: ${soilType}
- Farm Stage: ${context.farmStage || 'general'}

RELEVANT DATA SOURCES:
${calendarInfo ? `PLANTING CALENDAR FOR ${region.toUpperCase()}:\n${calendarInfo}\n\n` : ''}
${soilDataInfo ? `REAL-TIME SOIL DATA (from ISRIC SoilGrids):\n${soilDataInfo}\n\n` : ''}
${soilInfo ? `SOIL MANAGEMENT TIPS:\n${soilInfo}\n\n` : ''}
${relevantDocs.length > 0 ? `ADDITIONAL KNOWLEDGE BASE:\n${relevantDocs.join('\n\n')}\n\n` : ''}

FARMER'S QUESTION: "${query}"

${conversationHistory && conversationHistory.length > 0 ? `CONVERSATION CONTEXT:
${conversationHistory.slice(-3).map(msg => `${msg.role === 'user' ? 'Farmer' : 'You'}: ${msg.content}`).join('\n')}

Use this conversation history to:
- Understand follow-up questions and references to previous topics
- Provide continuity in your responses
- Avoid repeating information already shared
- Build on previous advice given

` : ''}${queryAnalysis ? `QUERY ANALYSIS:
- Complexity: ${queryAnalysis.complexity}
- Type: ${queryAnalysis.type}
- Recommended response length: ${queryAnalysis.estimatedResponseLength}
${queryAnalysis.complexity === 'simple' ? '\nIMPORTANT: This is a simple query. Provide a brief, concise answer (2-4 sentences). Do not provide excessive detail.' : ''}
${queryAnalysis.complexity === 'complex' ? '\nIMPORTANT: This is a complex query. Provide comprehensive, detailed information with examples.' : ''}

` : ''}INSTRUCTIONS:
1. Analyze the question carefully - if it's a follow-up, use conversation context to understand what the farmer is referring to
2. Use the planting calendar, soil data, and knowledge base above to provide accurate, region-specific advice
3. Reference specific planting seasons, soil conditions, and best practices for ${region}
4. Provide actionable steps the farmer can take immediately
5. If the question is about timing, reference the planting calendar
6. If the question is about soil, use the real-time soil data provided
7. Be specific, practical, and encouraging
8. Use Kenyan agricultural terminology and measurements (acres, bags, etc.)
9. If this is a follow-up question, reference previous conversation naturally without repeating everything
10. ${queryAnalysis?.complexity === 'simple' ? 'Keep your response brief and to the point.' : 'Provide comprehensive but well-structured answers.'}

IMPORTANT: Provide a direct response without repeating the question or using "Question:" or "Answer:" labels. Just give the advice directly.

${queryAnalysis?.complexity === 'simple' ? 'Format: Brief, friendly response (2-4 sentences maximum).' : `Format your response with:
- Clear headings for different sections
- Numbered or bulleted lists for steps
- Specific recommendations
- Encouraging and supportive tone`}

Respond in ${context.user.preferredLanguage === 'sw' ? 'Kiswahili' : 'English'} with clear, well-structured advice.`;

      // Disable cache if conversation history exists (conversational context)
      const useCache = !conversationHistory || conversationHistory.length === 0;
      const response = await generateText(
        prompt, 
        'gemini-2.0-flash-exp', 
        useCache, 
        cropAdvisorSystemInstructions,
        0.2 // Lower temperature for more focused, consistent responses
      );
      return response;
    } catch (error) {
      logger.error('Error in crop advisor agent:', error);
      return 'I apologize, but I encountered an error processing your crop question. Please try rephrasing or contact an extension officer.';
    }
  }
}

export const cropAdvisorAgent = new CropAdvisorAgent();

