// Query complexity and type analysis utility

export interface QueryAnalysis {
  complexity: 'simple' | 'moderate' | 'complex';
  type: 'question' | 'statement' | 'greeting' | 'command';
  requiresDetail: boolean;
  estimatedResponseLength: 'short' | 'medium' | 'long';
  urgency: 'low' | 'medium' | 'high';
  keywords: string[];
}

export class QueryAnalyzer {
  /**
   * Analyze query to determine complexity and requirements
   */
  static analyze(query: string): QueryAnalysis {
    const normalized = query.toLowerCase().trim();
    const words = normalized.split(/\s+/);
    const wordCount = words.length;
    
    // Detect query type
    const type = this.detectQueryType(normalized, wordCount);
    
    // Extract keywords
    const keywords = this.extractKeywords(normalized);
    
    // Determine complexity
    const complexity = this.determineComplexity(normalized, wordCount, keywords);
    
    // Check if detail is required
    const requiresDetail = this.requiresDetailedResponse(normalized, complexity);
    
    // Estimate response length needed
    const estimatedResponseLength = this.estimateResponseLength(complexity, requiresDetail);
    
    // Determine urgency (for health-related queries)
    const urgency = this.determineUrgency(normalized, keywords);
    
    return {
      complexity,
      type,
      requiresDetail,
      estimatedResponseLength,
      urgency,
      keywords,
    };
  }
  
  private static detectQueryType(query: string, wordCount: number): QueryAnalysis['type'] {
    // Greetings
    const greetings = ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon'];
    if (greetings.some(g => query.includes(g)) && wordCount < 5) {
      return 'greeting';
    }
    
    // Commands
    const commandWords = ['tell me', 'show me', 'give me', 'explain', 'describe', 'list'];
    if (commandWords.some(c => query.includes(c))) {
      return 'command';
    }
    
    // Questions
    const questionWords = ['what', 'when', 'where', 'why', 'how', 'which', 'who'];
    const hasQuestionMark = query.includes('?');
    if (questionWords.some(q => query.startsWith(q) || query.includes(` ${q} `)) || hasQuestionMark) {
      return 'question';
    }
    
    return 'statement';
  }
  
  private static extractKeywords(query: string): string[] {
    // Common agricultural keywords
    const agriculturalTerms = [
      'maize', 'wheat', 'rice', 'beans', 'potato', 'tomato', 'coffee', 'tea',
      'cattle', 'cow', 'goat', 'sheep', 'chicken', 'poultry',
      'pest', 'disease', 'symptom', 'treatment', 'spray',
      'weather', 'rain', 'climate', 'drought', 'flood',
      'price', 'market', 'sell', 'buy', 'harvest', 'planting',
      'soil', 'fertilizer', 'irrigation', 'watering'
    ];
    
    return agriculturalTerms.filter(term => query.includes(term));
  }
  
  private static determineComplexity(
    query: string, 
    wordCount: number, 
    keywords: string[]
  ): QueryAnalysis['complexity'] {
    // Simple: short queries, single topic, basic questions
    if (wordCount <= 5 && keywords.length <= 1) {
      return 'simple';
    }
    
    // Complex: long queries, multiple topics, detailed requests
    const complexIndicators = [
      'explain in detail', 'comprehensive', 'step by step', 'all about',
      'compare', 'difference between', 'advantages and disadvantages'
    ];
    
    if (wordCount > 20 || keywords.length > 3 || complexIndicators.some(ind => query.includes(ind))) {
      return 'complex';
    }
    
    return 'moderate';
  }
  
  private static requiresDetailedResponse(query: string, complexity: QueryAnalysis['complexity']): boolean {
    const detailKeywords = [
      'explain', 'describe', 'detail', 'comprehensive', 'step by step',
      'how to', 'guide', 'tutorial', 'all about', 'everything about'
    ];
    
    if (complexity === 'complex') return true;
    if (detailKeywords.some(kw => query.includes(kw))) return true;
    
    return false;
  }
  
  private static estimateResponseLength(
    complexity: QueryAnalysis['complexity'],
    requiresDetail: boolean
  ): QueryAnalysis['estimatedResponseLength'] {
    if (complexity === 'simple' && !requiresDetail) {
      return 'short';
    }
    
    if (complexity === 'complex' || requiresDetail) {
      return 'long';
    }
    
    return 'medium';
  }
  
  private static determineUrgency(query: string, keywords: string[]): QueryAnalysis['urgency'] {
    const urgentKeywords = [
      'emergency', 'urgent', 'dying', 'dead', 'critical', 'severe',
      'not eating', 'not drinking', 'bleeding', 'unconscious', 'collapse'
    ];
    
    const healthKeywords = ['sick', 'disease', 'symptom', 'treatment', 'medicine', 'vet'];
    const hasHealthKeywords = healthKeywords.some(kw => keywords.includes(kw) || query.includes(kw));
    
    if (urgentKeywords.some(kw => query.includes(kw))) {
      return 'high';
    }
    
    if (hasHealthKeywords) {
      return 'medium';
    }
    
    return 'low';
  }
  
  /**
   * Get recommended response length in tokens/words
   */
  static getRecommendedLength(analysis: QueryAnalysis): { min: number; max: number; target: number } {
    switch (analysis.estimatedResponseLength) {
      case 'short':
        return { min: 20, max: 100, target: 50 };
      case 'medium':
        return { min: 100, max: 300, target: 200 };
      case 'long':
        return { min: 300, max: 800, target: 500 };
      default:
        return { min: 100, max: 300, target: 200 };
    }
  }
  
  /**
   * Check if query indicates emergency situation
   */
  static isEmergency(inputQuery: string): boolean {
    const analysis = this.analyze(inputQuery);
    return analysis.urgency === 'high';
  }
  
  /**
   * Check if query is simple and should get brief response
   */
  static isSimpleQuery(inputQuery: string): boolean {
    const analysis = this.analyze(inputQuery);
    return analysis.complexity === 'simple' && !analysis.requiresDetail;
  }
}

