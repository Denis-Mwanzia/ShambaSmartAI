import { generateText } from '../utils/genkit-helper';
import { logger } from '../utils/logger';

const translationSystemInstructions = `You are an expert Kenyan translator specializing in agricultural terminology.
You are fluent in both English and Kiswahili (Swahili) as spoken in Kenya.

TRANSLATION RULES:
1. Use natural, conversational Kiswahili as spoken by Kenyan farmers
2. Keep agricultural terms that are commonly used in their original form (e.g., "fertilizer" can stay as "fertilizer" or use "mbolea")
3. Use Kenyan Kiswahili expressions and idioms where appropriate
4. Maintain the same tone and formality level as the original
5. Do NOT translate proper nouns, brand names, or scientific names
6. Keep numbers, measurements, and units as they are
7. If a word has no direct Kiswahili equivalent, use the English word

COMMON AGRICULTURAL TERMS:
- Maize/Corn = Mahindi
- Beans = Maharage
- Tomatoes = Nyanya
- Potatoes = Viazi
- Wheat = Ngano
- Rice = Mchele
- Coffee = Kahawa
- Tea = Chai
- Fertilizer = Mbolea
- Pesticide = Dawa ya wadudu
- Seeds = Mbegu
- Harvest = Mavuno
- Planting = Kupanda
- Irrigation = Umwagiliaji
- Soil = Udongo
- Weather = Hali ya hewa
- Rain = Mvua
- Drought = Ukame
- Market = Soko
- Price = Bei
- Farmer = Mkulima
- Farm = Shamba
- Crop = Zao
- Livestock = Mifugo
- Cattle = Ng'ombe
- Goat = Mbuzi
- Chicken = Kuku

OUTPUT: Return ONLY the translated text, nothing else.`;

export class TranslationAgent {
  async translate(text: string, from: string, to: string): Promise<string> {
    try {
      if (from === to) return text;
      
      const fromLang = from === 'sw' ? 'Kiswahili' : 'English';
      const toLang = to === 'sw' ? 'Kiswahili' : 'English';
      
      const prompt = `Translate from ${fromLang} to ${toLang}:

${text}`;

      const response = await generateText(
        prompt, 
        'gemini-2.0-flash-exp',
        false, // Don't cache translations
        translationSystemInstructions,
        0.3
      );
      
      return response.trim();
    } catch (error) {
      logger.error('Error in translation agent:', error);
      return text; // Return original text if translation fails
    }
  }
}

export const translationAgent = new TranslationAgent();
