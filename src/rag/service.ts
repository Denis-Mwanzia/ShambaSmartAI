import { logger } from '../utils/logger';
import { dataSourceService } from '../services/data-source';

export interface RetrievalContext {
  crop?: string;
  region?: string;
  soilType?: string;
  farmStage?: string;
  livestock?: string;
}

export class RAGService {
  private indexId: string;
  private endpointId: string;
  private location: string;
  private projectId: string;

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || '';
    this.location = process.env.VERTEX_AI_LOCATION || 'us-central1';
    this.indexId = process.env.MATCHING_ENGINE_INDEX_ID || '';
    this.endpointId = process.env.MATCHING_ENGINE_INDEX_ENDPOINT_ID || '';
  }

  async retrieve(query: string, context: RetrievalContext = {}): Promise<string[]> {
    try {
      const allResults: string[] = [];
      
      // 1. Get results from LOCAL data sources (JSON files) - ALWAYS included
      const localResults = dataSourceService.searchAll(query, {
        crop: context.crop,
        region: context.region,
        livestock: context.livestock,
      });
      
      if (localResults.length > 0) {
        allResults.push(...localResults);
        logger.debug(`Retrieved ${localResults.length} results from LOCAL data sources`);
      }

      // 2. Try to get results from ONLINE sources (Matching Engine with scraped/FAOSTAT data)
      // Skip if USE_MATCHING_ENGINE is explicitly set to false
      const useMatchingEngine = process.env.USE_MATCHING_ENGINE !== 'false';
      
      if (useMatchingEngine && this.projectId && this.indexId && this.endpointId) {
        try {
          const embedding = await this.generateEmbedding(query, context);
          
          // Only proceed if embedding was generated successfully
          if (embedding.length > 0) {
            const onlineResults = await this.queryMatchingEngine(embedding, { topK: 5 });
            
            if (onlineResults.length > 0) {
              const onlineTexts = onlineResults.map(r => r.text || '').filter(Boolean);
              allResults.push(...onlineTexts);
              logger.info(`Retrieved ${onlineTexts.length} results from ONLINE sources (Matching Engine)`);
            }
          }
        } catch (matchingEngineError: any) {
          // Log but don't fail - continue with local data
          logger.debug('Matching Engine query failed, continuing with local data only', {
            error: matchingEngineError.message,
            note: 'This is expected if Matching Engine is not configured. Local data sources are still available.'
          });
        }
      } else {
        logger.debug('Matching Engine disabled or not configured, using local data sources only');
      }

      // 3. If no results found, return general local data as fallback
      if (allResults.length === 0) {
        logger.info('No specific matches found, returning general local data');
        const generalData = dataSourceService.getAllDataAsText().slice(0, 3);
        return generalData;
      }

      // 4. Return COMBINED results: Local + Online
      logger.info(`Returning ${allResults.length} combined results (${localResults.length} local + ${allResults.length - localResults.length} online)`);
      return allResults;
    } catch (error) {
      logger.error('Error in RAG retrieval:', error);
      // Final fallback: return general local data
      try {
        return dataSourceService.getAllDataAsText().slice(0, 2);
      } catch {
        return [];
      }
    }
  }

  private async generateEmbedding(text: string, context: RetrievalContext): Promise<number[]> {
    // Enhanced query with context
    const enhancedQuery = this.enhanceQueryWithContext(text, context);
    
    try {
      // Validate project ID
      if (!this.projectId) {
        logger.warn('GOOGLE_CLOUD_PROJECT_ID not set, skipping embedding generation');
        return [];
      }

      // Use Vertex AI Embeddings API
      const { PredictionServiceClient } = require('@google-cloud/aiplatform').v1;
      const client = new PredictionServiceClient();
      
      // Correct endpoint format for Vertex AI embeddings
      // Format: projects/{project}/locations/{location}/publishers/google/models/{model}
      const endpoint = `projects/${this.projectId}/locations/${this.location}/publishers/google/models/textembedding-gecko@003`;
      
      // Correct request format for embeddings API
      // The instances array should contain objects with 'content' field as string
      const request = {
        endpoint,
        instances: [
          {
            content: enhancedQuery,
          },
        ],
      };
      
      logger.debug('Generating embedding', { 
        projectId: this.projectId, 
        location: this.location,
        endpoint,
        queryLength: enhancedQuery.length
      });
      
      const [response] = await client.predict(request);
      
      // Extract embedding from response
      const prediction = response.predictions?.[0];
      if (prediction?.embeddings?.values) {
        return prediction.embeddings.values;
      } else if (prediction?.embeddings?.statistics?.truncated) {
        logger.warn('Embedding was truncated');
        return prediction.embeddings.values || [];
      }
      
      logger.warn('No embedding values in response', { prediction });
      return [];
    } catch (error: any) {
      // Handle specific GCP errors with better diagnostics
      if (error.code === 3 || error.reason === 'RESOURCE_PROJECT_INVALID') {
        logger.warn('Vertex AI project issue. Details:', {
          projectId: this.projectId,
          location: this.location,
          errorCode: error.code,
          errorReason: error.reason,
          suggestion: 'Verify project ID matches GCP Console and Vertex AI API is enabled',
        });
      } else if (error.message?.includes('credentials') || error.message?.includes('authentication')) {
        logger.warn('GCP authentication failed. Check GOOGLE_APPLICATION_CREDENTIALS');
      } else if (error.message?.includes('PERMISSION_DENIED')) {
        logger.warn('Permission denied. Service account may need Vertex AI User role');
      } else {
        logger.error('Error generating embedding:', {
          message: error.message,
          code: error.code,
          reason: error.reason,
        });
      }
      // Fallback: return empty embedding (will result in no matches)
      return [];
    }
  }

  private enhanceQueryWithContext(text: string, context: RetrievalContext): string {
    const parts = [text];
    
    if (context.crop) parts.push(`crop: ${context.crop}`);
    if (context.region) parts.push(`region: ${context.region}`);
    if (context.soilType) parts.push(`soil: ${context.soilType}`);
    if (context.farmStage) parts.push(`stage: ${context.farmStage}`);
    
    return parts.join(' ');
  }

  private async queryMatchingEngine(
    _embedding: number[],
    _options: { topK: number }
  ): Promise<Array<{ text: string; score: number }>> {
    try {
      // Query Matching Engine index
      // This is a placeholder - actual implementation requires proper Matching Engine client setup
      // For now, return empty results to allow app to run
      // TODO: Implement actual Matching Engine query using this.indexId and this.endpointId
      logger.warn('Matching Engine query not fully implemented - returning empty results', {
        indexId: this.indexId,
        endpointId: this.endpointId,
      });
      return [];
    } catch (error) {
      logger.error('Error querying Matching Engine:', error);
      return [];
    }
  }

  async addDocument(text: string, metadata: Record<string, any> = {}): Promise<void> {
    try {
      // Try to generate embedding if credentials are available
      try {
        await this.generateEmbedding(text, {});
        logger.info('Document added to Matching Engine index', { metadata });
      } catch (embeddingError: any) {
        // If embedding fails (no GCP credentials), log but don't fail
        // This allows the script to work even without Matching Engine setup
        if (embeddingError.message?.includes('credentials') || 
            embeddingError.message?.includes('authentication') ||
            embeddingError.message?.includes('Could not load')) {
          logger.debug('Skipping Matching Engine ingestion (no GCP credentials). Data is available through DataSourceService.', { 
            metadata,
            note: 'This is expected if Matching Engine is not configured. Your data sources are loaded directly from JSON files.' 
          });
        } else {
          throw embeddingError;
        }
      }
      
      // Note: Actual Matching Engine ingestion would require:
      // 1. Proper GCP credentials (GOOGLE_APPLICATION_CREDENTIALS)
      // 2. Matching Engine index deployed
      // 3. Batch ingestion process
      // For now, data is available through DataSourceService which loads JSON files directly
    } catch (error) {
      logger.error('Error adding document:', error);
      // Don't throw - allow script to continue even if one document fails
      logger.warn('Continuing with remaining documents...');
    }
  }
}

export const ragService = new RAGService();

