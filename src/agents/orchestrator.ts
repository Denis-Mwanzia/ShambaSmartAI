import { UserContext } from '../models/user';
import { cropAdvisorAgent } from './crop-advisor';
import { livestockHealthAgent } from './livestock-health';
import { pestDetectionAgent } from './pest-detection';
import { climateAlertAgent } from './climate-alert';
import { marketIntelligenceAgent } from './market-intelligence';
import { extensionSupportAgent } from './extension-support';
import { translationAgent } from './translation';
import { generateText } from '../utils/genkit-helper';
import { logger } from '../utils/logger';

export interface AgentResponse {
  agent: string;
  response: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export class AgentOrchestrator {
  async processQuery(
    query: string, 
    context: UserContext,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    language: string = 'en'
  ): Promise<string> {
    try {
      // Handle simple greetings and casual conversation first
      const normalizedQuery = query.toLowerCase().trim();
      if (this.isGreeting(normalizedQuery)) {
        const greeting = this.handleGreeting(context, conversationHistory);
        // Translate greeting if Swahili
        if (language === 'sw') {
          return await translationAgent.translate(greeting, 'en', 'sw');
        }
        return greeting;
      }
      
      // If language is Swahili, translate query to English for processing
      let processedQuery = query;
      if (language === 'sw') {
        processedQuery = await translationAgent.translate(query, 'sw', 'en');
        logger.info(`Translated query from Swahili: "${query}" -> "${processedQuery}"`);
      }
      
      // Classify intent with AI (with conversation context) - use translated query
      const intent = await this.classifyIntent(processedQuery, context, conversationHistory);
      
      // Route to appropriate agent(s)
      const agentResponses: AgentResponse[] = [];
      
      // Handle greeting separately (already handled above, but double-check)
      if (intent === 'greeting') {
        const greeting = this.handleGreeting(context, conversationHistory);
        if (language === 'sw') {
          return await translationAgent.translate(greeting, 'en', 'sw');
        }
        return greeting;
      }
      
      // Primary agent based on intent - use processedQuery (translated to English)
      if (intent.includes('crop') || intent.includes('planting') || intent.includes('harvest')) {
        agentResponses.push(await cropAdvisorAgent.process(processedQuery, context, conversationHistory));
      }
      
      if (intent.includes('livestock') || intent.includes('cattle') || intent.includes('goat') || intent.includes('chicken')) {
        agentResponses.push(await livestockHealthAgent.process(processedQuery, context, conversationHistory));
      }
      
      if (intent.includes('pest') || intent.includes('disease') || intent.includes('symptom')) {
        agentResponses.push(await pestDetectionAgent.process(processedQuery, context, conversationHistory));
      }
      
      if (intent.includes('weather') || intent.includes('rain') || intent.includes('climate')) {
        agentResponses.push(await climateAlertAgent.process(processedQuery, context, conversationHistory));
      }
      
      if (intent.includes('price') || intent.includes('market') || intent.includes('sell')) {
        agentResponses.push(await marketIntelligenceAgent.process(processedQuery, context, conversationHistory));
      }
      
      if (intent.includes('extension') || intent.includes('help') || intent.includes('support')) {
        agentResponses.push(await extensionSupportAgent.process(processedQuery, context, conversationHistory));
      }
      
      // If no specific agent matched and it's not a greeting, use crop advisor as default
      if (agentResponses.length === 0) {
        agentResponses.push(await cropAdvisorAgent.process(processedQuery, context, conversationHistory));
      }
      
      // Combine responses
      const combinedResponse = this.combineResponses(agentResponses);
      
      // Translate if needed (use passed language parameter or user preference)
      const targetLanguage = language || context.user.preferredLanguage || 'en';
      if (targetLanguage === 'sw') {
        return await translationAgent.translate(combinedResponse, 'en', 'sw');
      }
      
      return combinedResponse;
    } catch (error) {
      logger.error('Error in agent orchestrator:', error);
      return 'Sorry, I encountered an error. Please try again or contact support.';
    }
  }
  
  private async classifyIntent(
    query: string, 
    context?: UserContext,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    try {
      // Use AI for better intent classification with conversation context
      const locationInfo = context?.user.county 
        ? `User is located in ${context.user.county}, Kenya. `
        : context?.coordinates
        ? `User coordinates: ${context.coordinates.lat}, ${context.coordinates.lon}. `
        : '';
      
      // Build conversation context if available
      let conversationContext = '';
      if (conversationHistory && conversationHistory.length > 0) {
        const recentHistory = conversationHistory.slice(-4); // Last 4 messages
        conversationContext = '\n\nRecent conversation context:\n';
        recentHistory.forEach(msg => {
          conversationContext += `${msg.role === 'user' ? 'Farmer' : 'Assistant'}: ${msg.content}\n`;
        });
        conversationContext += '\nConsider this context when classifying the current question.';
      }
      
      const prompt = `You are an intelligent intent classifier for an agricultural AI assistant in Kenya. Analyze the farmer's question and classify it into ONE of these categories:

Categories:
- greeting: Simple greetings, casual conversation, "hello", "hi", "how are you", or very short non-agricultural messages
- crop: Questions about crops, planting, growing, harvesting, crop varieties, crop management, soil for crops
- livestock: Questions about cattle, goats, chickens, sheep, livestock health, feeding, breeding, animal care
- pest: Questions about pests, diseases, symptoms, pest control, disease treatment, infections
- weather: Questions about weather, rainfall, climate, forecasts, weather alerts, drought, flooding
- market: Questions about prices, markets, selling, trading, market trends, where to sell, best prices
- extension: Questions about getting help, contacting extension officers, support, resources, training

${locationInfo}${conversationContext}

Current Farmer Question: "${query}"

Instructions:
- If the message is just a greeting (hello, hi, etc.) or casual conversation, classify as "greeting"
- If the question is a follow-up to previous conversation, use context to understand intent
- If question is vague or unclear, infer the most likely intent based on keywords and context
- Consider the user's location and previous questions when classifying
- Only classify as agricultural categories if there's clear agricultural intent

Respond with ONLY the category name (greeting, crop, livestock, pest, weather, market, or extension). Do not include any other text.`;

      // Disable cache for intent classification (needs fresh analysis)
      // Use lower temperature for more consistent classification
      const aiClassification = await generateText(prompt, 'gemini-2.0-flash-exp', false, undefined, 0.2);
      const cleaned = aiClassification.toLowerCase().trim();
      
      // Validate and return
      const validCategories = ['greeting', 'crop', 'livestock', 'pest', 'weather', 'market', 'extension'];
      const category = validCategories.find(cat => cleaned.includes(cat));

      if (category) {
        return category;
      }
      
      // Fallback to keyword-based classification
      return this.keywordBasedClassification(query);
    } catch (error) {
      logger.warn('AI intent classification failed, using keyword-based:', error);
      return this.keywordBasedClassification(query);
    }
  }

  private isGreeting(query: string): boolean {
    const greetings = [
      // English
      'hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 
      'good evening', 'good day', 'howdy', 'sup', 'what\'s up', 'how are you',
      'how do you do', 'nice to meet you', 'pleased to meet you',
      // Swahili
      'habari', 'jambo', 'mambo', 'salama', 'shikamoo', 'hujambo', 'habari yako',
      'habari za asubuhi', 'habari za mchana', 'habari za jioni'
    ];
    
    // Agricultural keywords that indicate NOT a greeting
    const farmingKeywords = [
      // English
      'plant', 'grow', 'crop', 'maize', 'farm', 'harvest', 'pest', 'weather', 'price', 'market',
      // Swahili
      'panda', 'kupanda', 'lima', 'kulima', 'mahindi', 'shamba', 'mavuno', 'wadudu', 'hali', 'bei', 'soko',
      'mbolea', 'mbegu', 'maji', 'udongo', 'zao', 'mazao', 'mifugo', 'ng\'ombe', 'kuku', 'mbuzi'
    ];
    
    // If query contains farming keywords, it's NOT a greeting
    if (farmingKeywords.some(kw => query.includes(kw))) {
      return false;
    }
    
    // Check if query is ONLY a greeting (very short and matches greeting patterns)
    if (query.length < 20) {
      return greetings.some(greeting => query === greeting || query.startsWith(greeting + ' ') || query.endsWith(' ' + greeting));
    }
    
    return false;
  }

  private handleGreeting(
    context: UserContext,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): string {
    const isSwahili = context.user.preferredLanguage === 'sw';
    
    // If there's conversation history, it's not the first message
    if (conversationHistory && conversationHistory.length > 0) {
      return isSwahili 
        ? 'Habari! Unaweza kuuliza swali lolote kuhusu kilimo. Nitafurahi kukusaidia.'
        : 'Hello! Feel free to ask me any farming question. I\'m here to help.';
    }
    
    // First message - welcome message
    return isSwahili
      ? 'Karibu! Mimi ni msaidizi wako wa kilimo. Nisaidie kwa swali lolote kuhusu mazao, mifugo, wadudu, hali ya hewa, au soko. Unaweza kuuliza nini?'
      : 'Hello! I\'m your agricultural assistant. I can help you with crops, livestock, pests, weather, or market information. What would you like to know?';
  }

  private keywordBasedClassification(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    // Check for greetings first
    if (this.isGreeting(lowerQuery)) {
      return 'greeting';
    }
    
    // Enhanced keyword matching
    const cropKeywords = ['crop', 'plant', 'maize', 'wheat', 'rice', 'beans', 'potato', 'tomato', 'coffee', 'tea', 'sorghum', 'millet', 'harvest', 'planting', 'growing'];
    const livestockKeywords = ['livestock', 'cattle', 'cow', 'goat', 'sheep', 'chicken', 'poultry', 'dairy', 'milk', 'meat', 'breeding'];
    const pestKeywords = ['pest', 'disease', 'symptom', 'infected', 'damage', 'control', 'treatment', 'spray', 'fungus', 'bacteria', 'virus'];
    const weatherKeywords = ['weather', 'rain', 'rainfall', 'climate', 'forecast', 'drought', 'flood', 'temperature', 'humidity'];
    const marketKeywords = ['price', 'market', 'sell', 'buy', 'trading', 'cost', 'value', 'revenue', 'profit'];
    const extensionKeywords = ['help', 'support', 'extension', 'officer', 'contact', 'assistance', 'advice'];
    
    if (cropKeywords.some(kw => lowerQuery.includes(kw))) return 'crop';
    if (livestockKeywords.some(kw => lowerQuery.includes(kw))) return 'livestock';
    if (pestKeywords.some(kw => lowerQuery.includes(kw))) return 'pest';
    if (weatherKeywords.some(kw => lowerQuery.includes(kw))) return 'weather';
    if (marketKeywords.some(kw => lowerQuery.includes(kw))) return 'market';
    if (extensionKeywords.some(kw => lowerQuery.includes(kw))) return 'extension';
    
    return 'general';
  }
  
  private combineResponses(responses: AgentResponse[]): string {
    if (responses.length === 0) return 'I could not find relevant information.';
    if (responses.length === 1) return responses[0].response;
    
    // Combine multiple agent responses
    const primary = responses[0];
    const additional = responses.slice(1)
      .filter(r => r.confidence > 0.5)
      .map(r => r.response)
      .join('\n\n');
    
    return `${primary.response}\n\n${additional}`;
  }
}

export const agentOrchestrator = new AgentOrchestrator();

