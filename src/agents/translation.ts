import { generateText } from '../utils/genkit-helper';
import { logger } from '../utils/logger';

export class TranslationAgent {
  async translate(text: string, from: string, to: string): Promise<string> {
    try {
      if (from === to) return text;
      
      const prompt = `Translate the following agricultural advice from ${from} to ${to}. 
Maintain the technical accuracy and cultural appropriateness for Kenyan farmers.

Text to translate:
${text}

Translation:`;

      const response = await generateText(prompt, 'gemini-2.0-flash-exp');
      return response;
    } catch (error) {
      logger.error('Error in translation agent:', error);
      return text; // Return original text if translation fails
    }
  }
}

export const translationAgent = new TranslationAgent();
