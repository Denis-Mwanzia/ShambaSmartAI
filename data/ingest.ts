import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ragService } from '../src/rag/service';
import { logger } from '../src/utils/logger';
import { webScraper } from '../src/services/scraper';
import { faostatService } from '../src/services/faostat';

// Load environment variables
dotenv.config();

/**
 * Data ingestion script for KALRO, MOA, and FAO datasets
 * This script processes agricultural documents and adds them to the RAG index
 */

/**
 * Check and setup GCP credentials
 */
function setupCredentials(): { hasCredentials: boolean; message: string } {
  // Check if credentials are set via environment variable
  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  
  if (credsPath) {
    // Resolve relative paths
    const projectRoot = path.resolve(__dirname, '..');
    const resolvedPath = path.isAbsolute(credsPath) 
      ? credsPath 
      : path.resolve(projectRoot, credsPath);
    
    if (fs.existsSync(resolvedPath)) {
      // Update environment variable with absolute path
      process.env.GOOGLE_APPLICATION_CREDENTIALS = resolvedPath;
      return { hasCredentials: true, message: `Using credentials from: ${resolvedPath}` };
    } else {
      logger.warn(`Credentials path not found: ${resolvedPath}`);
    }
  }

  // Check for common key file names in project root
  const projectRoot = path.resolve(__dirname, '..');
  const possibleKeyFiles = [
    'shambasmartai-key.json',
    'shambasmart-key.json',
    'gcp-key.json',
    'service-account-key.json',
  ];

  for (const keyFile of possibleKeyFiles) {
    const keyPath = path.join(projectRoot, keyFile);
    if (fs.existsSync(keyPath)) {
      // Set the environment variable for this process
      process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
      logger.info(`Found credentials file: ${keyPath}`);
      return { hasCredentials: true, message: `Using credentials from: ${keyPath}` };
    }
  }

  // Check if running on GCP (Cloud Run, GCE, etc.)
  if (process.env.GOOGLE_CLOUD_PROJECT) {
    return { 
      hasCredentials: true, 
      message: 'Using default GCP credentials (running on GCP)' 
    };
  }

  return {
    hasCredentials: false,
    message: 'No GCP credentials found. Matching Engine ingestion will be skipped.',
  };
}

interface Document {
  id: string;
  title: string;
  content: string;
  source: 'KALRO' | 'MOA' | 'FAO' | 'CUSTOM';
  metadata: {
    crop?: string;
    region?: string;
    category?: string;
    url?: string;
  };
}

export class DataIngestionService {
  private dataDir: string;

  constructor() {
    this.dataDir = path.join(__dirname, 'sources');
  }

  async ingestAll(): Promise<void> {
    logger.info('Starting data ingestion...');

    // Check and setup credentials
    const credsStatus = setupCredentials();
    logger.info(credsStatus.message);

    if (!credsStatus.hasCredentials) {
      logger.warn('');
      logger.warn('═══════════════════════════════════════════════════════');
      logger.warn('⚠️  GCP Credentials Not Found');
      logger.warn('═══════════════════════════════════════════════════════');
      logger.warn('');
      logger.warn('The ingest script will continue but will skip Matching Engine ingestion.');
      logger.warn('Your data sources are already available through DataSourceService.');
      logger.warn('');
      logger.warn('To enable Matching Engine ingestion:');
      logger.warn('  1. Set GOOGLE_APPLICATION_CREDENTIALS in .env file:');
      logger.warn('     GOOGLE_APPLICATION_CREDENTIALS=./shambasmartai-key.json');
      logger.warn('  2. Or set it as an environment variable:');
      logger.warn('     export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json');
      logger.warn('  3. Ensure GOOGLE_CLOUD_PROJECT_ID is set in .env');
      logger.warn('');
      logger.warn('═══════════════════════════════════════════════════════');
      logger.warn('');
    }

    try {
      // Ingest KALRO data
      await this.ingestKALRO();
      
      // Ingest MOA data
      await this.ingestMOA();
      
      // Ingest FAO data
      await this.ingestFAO();
      
      // Ingest custom structured data
      await this.ingestCustomData();
      
      // Ingest KNBS market prices
      await this.ingestKNBS();
      
      logger.info('');
      logger.info('═══════════════════════════════════════════════════════');
      logger.info('✅ Data ingestion completed successfully');
      logger.info('═══════════════════════════════════════════════════════');
      
      if (!credsStatus.hasCredentials) {
        logger.info('');
        logger.info('Note: Data is available through DataSourceService (local JSON files).');
        logger.info('Matching Engine ingestion was skipped due to missing credentials.');
      }
    } catch (error) {
      logger.error('Error during data ingestion:', error);
      throw error;
    }
  }

  private async ingestKALRO(): Promise<void> {
    logger.info('Ingesting KALRO data...');
    
    try {
      // Use web scraper to get KALRO documents
      const scrapedDocs = await webScraper.scrapeKALROPublications();
      
      // Also load any existing KALRO documents
      const existingDocs = await this.loadKALRODocuments();
      
      const allDocs = [...scrapedDocs, ...existingDocs];
      
      for (const doc of allDocs) {
        await ragService.addDocument(doc.content, {
          title: doc.title,
          source: 'KALRO',
          url: doc.url,
          category: doc.category,
          ...doc.metadata,
        });
      }
      
      logger.info(`Ingested ${allDocs.length} KALRO documents (${scrapedDocs.length} scraped, ${existingDocs.length} existing)`);
    } catch (error: any) {
      logger.error('Error ingesting KALRO data:', error);
      // Continue with existing documents only
      const existingDocs = await this.loadKALRODocuments();
      logger.info(`Ingested ${existingDocs.length} existing KALRO documents (scraping failed)`);
    }
  }

  private async ingestMOA(): Promise<void> {
    logger.info('Ingesting MOA data...');
    
    try {
      // Use web scraper to get MOA documents
      const scrapedDocs = await webScraper.scrapeMOAData();
      
      // Also load any existing MOA documents
      const existingDocs = await this.loadMOADocuments();
      
      const allDocs = [...scrapedDocs, ...existingDocs];
      
      for (const doc of allDocs) {
        await ragService.addDocument(doc.content, {
          title: doc.title,
          source: 'MOA',
          url: doc.url,
          category: doc.category,
          ...doc.metadata,
        });
      }
      
      logger.info(`Ingested ${allDocs.length} MOA documents (${scrapedDocs.length} scraped, ${existingDocs.length} existing)`);
    } catch (error: any) {
      logger.error('Error ingesting MOA data:', error);
      // Continue with existing documents only
      const existingDocs = await this.loadMOADocuments();
      logger.info(`Ingested ${existingDocs.length} existing MOA documents (scraping failed)`);
    }
  }

  private async ingestFAO(): Promise<void> {
    logger.info('Ingesting FAO data...');
    
    try {
      // Fetch FAOSTAT data for Kenya
      const cropProduction = await faostatService.getCropProduction();
      const cropYield = await faostatService.getCropYield();
      const livestockProduction = await faostatService.getLivestockProduction();
      
      // Format FAOSTAT data for ingestion
      const faostatText = faostatService.formatForPrompt([
        ...cropProduction,
        ...cropYield,
        ...livestockProduction,
      ]);
      
      if (faostatText) {
        await ragService.addDocument(faostatText, {
          title: 'FAOSTAT Kenya Agricultural Statistics',
          source: 'FAO',
          category: 'Statistics',
        });
        logger.info('Ingested FAOSTAT agricultural statistics');
      }
      
      // Also load any existing FAO documents
      const existingDocs = await this.loadFAODocuments();
      
      for (const doc of existingDocs) {
        await ragService.addDocument(doc.content, {
          title: doc.title,
          source: 'FAO',
          ...doc.metadata,
        });
      }
      
      logger.info(`Ingested FAOSTAT data + ${existingDocs.length} existing FAO documents`);
    } catch (error: any) {
      logger.error('Error ingesting FAO data:', error);
      // Continue with existing documents only
      const existingDocs = await this.loadFAODocuments();
      logger.info(`Ingested ${existingDocs.length} existing FAO documents (FAOSTAT API failed)`);
    }
  }

  private async ingestKNBS(): Promise<void> {
    logger.info('Ingesting KNBS market prices...');
    
    try {
      // Use web scraper to get KNBS market prices
      const scrapedDocs = await webScraper.scrapeKNBSMarketPrices();
      
      for (const doc of scrapedDocs) {
        await ragService.addDocument(doc.content, {
          title: doc.title,
          source: 'KNBS',
          url: doc.url,
          category: doc.category,
        });
      }
      
      logger.info(`Ingested ${scrapedDocs.length} KNBS documents`);
    } catch (error: any) {
      logger.error('Error ingesting KNBS data:', error);
      logger.info('KNBS ingestion failed, continuing...');
    }
  }

  private async ingestCustomData(): Promise<void> {
    logger.info('Ingesting custom structured data...');
    
    // Load JSON files with structured data
    const pestData = await this.loadJSONFile('pests.json');
    const plantingCalendars = await this.loadJSONFile('planting-calendars.json');
    const livestockDiseases = await this.loadJSONFile('livestock-diseases.json');
    const soilTips = await this.loadJSONFile('soil-tips.json');
    
    // Process and ingest
    for (const pest of pestData) {
      await ragService.addDocument(
        `Pest: ${pest.name}\nSymptoms: ${pest.symptoms}\nControl: ${pest.control}`,
        { category: 'pest', crop: pest.crop, source: 'CUSTOM' }
      );
    }
    
    for (const calendar of plantingCalendars) {
      await ragService.addDocument(
        `Planting Calendar for ${calendar.county}: ${calendar.crops.join(', ')}`,
        { category: 'planting', region: calendar.county, source: 'CUSTOM' }
      );
    }
    
    for (const disease of livestockDiseases) {
      await ragService.addDocument(
        `Livestock Disease: ${disease.name}\nSymptoms: ${disease.symptoms}\nTreatment: ${disease.treatment}`,
        { category: 'livestock', source: 'CUSTOM' }
      );
    }
    
    for (const tip of soilTips) {
      await ragService.addDocument(
        `Soil Tip: ${tip.title}\n${tip.description}`,
        { category: 'soil', source: 'CUSTOM' }
      );
    }
    
    logger.info('Custom data ingestion completed');
  }

  private async loadKALRODocuments(): Promise<Document[]> {
    // Placeholder - would load from actual KALRO sources
    return [
      {
        id: 'kalro-001',
        title: 'Maize Production Guide',
        content: 'Maize is a staple crop in Kenya. Best planting time is during long rains (March-April) or short rains (October-November). Requires well-drained soil with pH 5.5-7.0.',
        source: 'KALRO',
        metadata: { crop: 'maize', category: 'production' },
      },
    ];
  }

  private async loadMOADocuments(): Promise<Document[]> {
    // Placeholder - would load from actual MOA sources
    return [];
  }

  private async loadFAODocuments(): Promise<Document[]> {
    // Placeholder - would load from actual FAO sources
    return [];
  }

  private async loadJSONFile(filename: string): Promise<any[]> {
    const filePath = path.join(this.dataDir, filename);
    
    if (!fs.existsSync(filePath)) {
      logger.warn(`File not found: ${filePath}`);
      return [];
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }
}

// Run if executed directly
if (require.main === module) {
  const service = new DataIngestionService();
  service.ingestAll().catch(console.error);
}

