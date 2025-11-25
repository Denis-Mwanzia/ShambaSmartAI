// Helper to generate text using Vertex AI (preferred) or Google Generative AI (fallback)
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from './logger';
import { responseCache } from './response-cache';

// Clean response to remove Q&A formatting
function cleanResponse(text: string): string {
  // Remove "Question:" and "Answer:" prefixes and their content
  // Pattern: **Question:** ... **Answer:** ... or Question: ... Answer: ...
  let cleaned = text
    // Remove markdown bold Question/Answer headers
    .replace(/^\*\*Question:\*\*\s*.+?\n\n/ims, '')
    .replace(/^\*\*Answer:\*\*\s*/ims, '')
    // Remove plain Question/Answer headers
    .replace(/^Question:\s*.+?\n\n/ims, '')
    .replace(/^Answer:\s*/ims, '')
    // Remove any standalone "Question:" or "Answer:" lines
    .replace(/^Question:\s*$/ims, '')
    .replace(/^Answer:\s*$/ims, '')
    // Clean up extra whitespace
    .trim();
  
  return cleaned;
}

// Default to gemini-2.0-flash-exp which is available in Vertex AI
export async function generateText(
  prompt: string, 
  modelName: string = 'gemini-2.0-flash-exp',
  useCache: boolean = true,
  systemInstructions?: string,
  temperature: number = 0.3
): Promise<string> {
  try {
    // Check cache first (only for non-conversational prompts)
    if (useCache && prompt.length < 500) { // Only cache shorter prompts to avoid caching conversation history
      const cached = responseCache.get(prompt);
      if (cached) {
        return cached;
      }
    }
    // Try Vertex AI first if credentials are available (PREFERRED METHOD)
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    // Default to us-central1 (global location doesn't work with Node.js SDK)
    const location = process.env.VERTEX_AI_LOCATION || 'us-central1';
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    // Check if Vertex AI is configured
    if (projectId && credentialsPath) {
      try {
        logger.info(`Using Vertex AI for text generation with model: ${modelName}`, {
          projectId,
          location,
          modelName,
        });
        const result = await generateTextWithVertexAI(prompt, modelName, projectId, location, useCache, systemInstructions, temperature);
        logger.debug('Vertex AI generation successful');
        
        // Cache the response if caching is enabled
        if (useCache && prompt.length < 500) {
          responseCache.set(prompt, result);
        }
        
        return result;
      } catch (vertexError: any) {
        // Provide detailed error information for troubleshooting
        const errorCode = vertexError.code || 'UNKNOWN';
        const errorMessage = vertexError.message || 'Unknown error';
        
        // Check for specific error types
        if (errorCode === 5 || errorMessage.includes('not found') || errorMessage.includes('does not have access')) {
          logger.warn('Vertex AI model access denied. This usually means:', {
            issue: 'Model not found or project lacks access',
            possibleCauses: [
              'Vertex AI Generative AI API not enabled',
              'Service account missing Vertex AI User role',
              'Model not available in region',
              'Project not whitelisted for Gemini models'
            ],
            projectId,
            location,
            modelName,
            errorCode,
            errorMessage,
          });
        } else {
          logger.warn('Vertex AI generation failed, falling back to Google AI:', {
            error: errorMessage,
            code: errorCode,
            projectId,
            location,
            modelName,
          });
        }
        // Fall through to Google AI fallback
      }
    } else {
      logger.info('Vertex AI not configured, using Google AI API key', {
        hasProjectId: !!projectId,
        hasCredentials: !!credentialsPath,
      });
    }

    // Fallback to Google Generative AI (API key based)
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      logger.error('Neither Vertex AI nor Google AI API key is configured');
      return 'I apologize, but the AI service is not properly configured. Please contact support.';
    }

    logger.info(`Using Google Generative AI (API key) with model: gemini-2.0-flash`);
    // Use gemini-2.0-flash which is the current stable model
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Google Generative AI uses systemInstruction as a string or Part, not Content
    const request: any = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: temperature,
        maxOutputTokens: 2000,
        topP: 0.95,
      },
    };
    
    if (systemInstructions) {
      request.systemInstruction = systemInstructions;
    }
    
    const result = await model.generateContent(request);

    const response = result.response;
    let text = response.text();
    
    if (text) {
      // Clean up any Q&A formatting that might have been included
      text = cleanResponse(text);
      
      // Cache the response if caching is enabled
      if (useCache && prompt.length < 500) {
        responseCache.set(prompt, text);
      }
    }
    
    return text || 'I apologize, but I could not generate a response. Please try again.';
  } catch (error: any) {
    logger.error('Error generating text:', error);
    if (error.message) {
      logger.error('Error details:', error.message);
    }
    return 'I apologize, but I encountered an error processing your question. Please try again or contact support.';
  }
}

async function generateTextWithVertexAI(
  prompt: string,
  modelName: string,
  projectId: string,
  location: string,
  _useCache: boolean = true,
  systemInstructions?: string,
  temperature: number = 0.3
): Promise<string> {
  try {
    // Use Vertex AI Generative AI API (not Prediction API)
    // Gemini models must use the Generative AI client
    const { VertexAI } = require('@google-cloud/vertexai');
    
    // Initialize Vertex AI client
    const vertexAI = new VertexAI({
      project: projectId,
      location: location,
    });

    // Map model names to Vertex AI Generative AI model names
    const modelMap: Record<string, string> = {
      'gemini-1.5-pro': 'gemini-1.5-pro',
      'gemini-1.5-flash': 'gemini-1.5-flash',
      'gemini-2.0-flash': 'gemini-2.0-flash-exp',
      'gemini-2.0-flash-exp': 'gemini-2.0-flash-exp',
      'gemini-pro': 'gemini-pro',
    };

    const vertexModelName = modelMap[modelName] || 'gemini-1.5-pro';
    
    // Get the generative model
    // Vertex AI uses systemInstruction as Content with parts
    const modelConfig: any = {
      model: vertexModelName,
      generationConfig: {
        temperature: temperature,
        maxOutputTokens: 2000,
        topP: 0.95,
      },
    };
    
    if (systemInstructions) {
      modelConfig.systemInstruction = {
        parts: [{ text: systemInstructions }],
      };
    }
    
    const model = vertexAI.getGenerativeModel(modelConfig);

    logger.debug('Calling Vertex AI Generative AI', {
      modelName: vertexModelName,
      projectId,
      location,
      promptLength: prompt.length,
    });

    // Generate content
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    });

    const response = result.response;
    let text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (text) {
      // Clean up any Q&A formatting that might have been included
      text = cleanResponse(text);
      
      logger.debug('Vertex AI response received', {
        responseLength: text.length,
        model: vertexModelName,
      });
      
      // Note: Caching is handled in the calling function
      return text;
    }

    throw new Error('No text in Vertex AI response');
  } catch (error: any) {
    logger.error('Vertex AI generation error:', {
      error: error.message,
      code: error.code,
      details: error.details,
      modelName,
      projectId,
      location,
    });
    throw error;
  }
}

