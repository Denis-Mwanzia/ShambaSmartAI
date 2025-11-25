import { BaseAgent } from './base-agent';
import { UserContext } from '../models/user';
import { generateText } from '../utils/genkit-helper';
import { logger } from '../utils/logger';

export class ExtensionSupportAgent extends BaseAgent {
  name = 'Extension Officer Support';
  description = 'Supports extension officers with information and resources';
  
  protected async generateResponse(
    query: string,
    context: UserContext,
    relevantDocs: string[],
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    try {
      // Check if this is a simple query that doesn't need detailed response
      const isSimpleQuery = query.toLowerCase().trim().length < 30 && 
                           !query.toLowerCase().includes('?') &&
                           !query.toLowerCase().match(/\b(how|what|when|where|why|tell me|explain|describe|list|provide)\b/);
      
      const prompt = `You are an AI assistant supporting agricultural extension officers in Kenya. ${isSimpleQuery ? 'Provide a brief, concise response.' : 'Provide comprehensive information and resources.'}

Relevant Knowledge Base:
${relevantDocs.join('\n\n')}

Extension Officer Question: ${query}

${conversationHistory && conversationHistory.length > 0 ? `CONVERSATION CONTEXT:
${conversationHistory.slice(-3).map(msg => `${msg.role === 'user' ? 'Extension Officer' : 'You'}: ${msg.content}`).join('\n')}

Use this context to understand if this is a follow-up question.

` : ''}${isSimpleQuery ? `IMPORTANT: This appears to be a simple query. Provide a brief, friendly response (2-3 sentences maximum). Do not provide extensive technical details unless specifically requested.

` : `Provide:
1. Detailed technical information
2. Best practices and guidelines
3. Resource links and references
4. Training materials suggestions
5. Contact information for specialized support
6. If this is a follow-up, reference previous discussions and provide additional or clarifying information

`}IMPORTANT: Provide a direct response without repeating the question or using "Question:" or "Answer:" labels. Just give the information directly.

${isSimpleQuery ? '' : `Format your response with:
- Detailed technical information
- Best practices and guidelines
- Resource links and references
- Training materials suggestions
- Contact information for specialized support

`}Respond in ${context.user.preferredLanguage === 'sw' ? 'Kiswahili' : 'English'}.`;

      // Disable cache if conversation history exists (conversational context)
      const useCache = !conversationHistory || conversationHistory.length === 0;
      const response = await generateText(
        prompt, 
        'gemini-2.0-flash-exp', 
        useCache, 
        undefined, // No system instructions for extension support (general purpose)
        0.2
      );
      return response;
    } catch (error) {
      logger.error('Error in extension support agent:', error);
      return 'I apologize, but I encountered an error. Please contact the KALRO support team.';
    }
  }
}

export const extensionSupportAgent = new ExtensionSupportAgent();
