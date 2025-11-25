import { UserContext } from '../models/user';
import { AgentResponse } from './orchestrator';
import { ragService } from '../rag/service';
import { QueryAnalyzer } from '../utils/query-analyzer';
import { InputValidator } from '../utils/input-validator';
import { logger } from '../utils/logger';

export abstract class BaseAgent {
  abstract name: string;
  abstract description: string;
  
  async process(
    query: string, 
    context: UserContext,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<AgentResponse> {
    try {
      // Validate and sanitize input
      const validation = InputValidator.validate(query);
      if (!validation.isValid) {
        logger.warn(`Invalid input for ${this.name}:`, validation.errors);
        return {
          agent: this.name,
          response: 'I apologize, but I couldn\'t understand your question. Could you please rephrase it?',
          confidence: 0,
          metadata: { errors: validation.errors },
        };
      }
      
      // Normalize query
      const normalizedQuery = InputValidator.normalize(validation.sanitized);
      
      // Analyze query complexity
      const queryAnalysis = QueryAnalyzer.analyze(normalizedQuery);
      
      // Retrieve relevant context from RAG
      const relevantDocs = await ragService.retrieve(normalizedQuery, {
        crop: context.crop,
        region: context.region || context.user.county,
        soilType: context.soilType || context.user.soilType,
        farmStage: context.farmStage,
      });
      
      // Generate response using agent-specific logic with conversation context
      const response = await this.generateResponse(
        normalizedQuery, 
        context, 
        relevantDocs, 
        conversationHistory,
        queryAnalysis
      );
      
      // Calculate improved confidence
      const confidence = this.calculateConfidence(normalizedQuery, relevantDocs, queryAnalysis);
      
      return {
        agent: this.name,
        response,
        confidence,
        metadata: {
          retrievedDocs: relevantDocs.length,
          queryComplexity: queryAnalysis.complexity,
          urgency: queryAnalysis.urgency,
          warnings: validation.warnings,
        },
      };
    } catch (error) {
      logger.error(`Error in ${this.name} agent:`, error);
      return {
        agent: this.name,
        response: 'I apologize, but I encountered an error processing your question. Please try again.',
        confidence: 0,
        metadata: { error: true },
      };
    }
  }
  
  protected abstract generateResponse(
    query: string,
    context: UserContext,
    relevantDocs: string[],
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    queryAnalysis?: ReturnType<typeof QueryAnalyzer.analyze>
  ): Promise<string>;
  
  protected calculateConfidence(
    _query: string, 
    relevantDocs: string[], 
    queryAnalysis?: ReturnType<typeof QueryAnalyzer.analyze>
  ): number {
    // Base confidence from document count
    let confidence = 0.3;
    if (relevantDocs.length > 0) confidence = 0.5;
    if (relevantDocs.length >= 3) confidence = 0.8;
    if (relevantDocs.length >= 5) confidence = 0.9;
    
    // Adjust based on query complexity
    if (queryAnalysis) {
      if (queryAnalysis.complexity === 'simple' && relevantDocs.length > 0) {
        confidence = Math.min(confidence + 0.1, 0.95);
      }
      if (queryAnalysis.complexity === 'complex' && relevantDocs.length < 3) {
        confidence = Math.max(confidence - 0.2, 0.3);
      }
      
      // Higher confidence for queries with specific keywords
      if (queryAnalysis.keywords.length > 0) {
        confidence = Math.min(confidence + 0.05 * queryAnalysis.keywords.length, 0.95);
      }
    }
    
    return Math.round(confidence * 100) / 100; // Round to 2 decimal places
  }
}

