import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

export interface PestData {
  name: string;
  crop: string;
  symptoms: string;
  control: string;
}

export interface LivestockDiseaseData {
  name: string;
  livestock: string;
  symptoms: string;
  treatment: string;
}

export interface PlantingCalendarData {
  county: string;
  crops: string[];
  longRains: string;
  shortRains: string;
}

export interface SoilTipData {
  title: string;
  description: string;
}

export class DataSourceService {
  private dataDir: string;
  private pests: PestData[] = [];
  private livestockDiseases: LivestockDiseaseData[] = [];
  private plantingCalendars: PlantingCalendarData[] = [];
  private soilTips: SoilTipData[] = [];
  private initialized = false;

  constructor() {
    // Get data directory - works in both dev and production
    const projectRoot = path.resolve(__dirname, '../..');
    this.dataDir = path.join(projectRoot, 'data', 'sources');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      logger.info('Loading data sources from:', this.dataDir);
      
      // Load all data sources
      await Promise.all([
        this.loadPests(),
        this.loadLivestockDiseases(),
        this.loadPlantingCalendars(),
        this.loadSoilTips(),
      ]);

      this.initialized = true;
      logger.info('Data sources loaded successfully', {
        pests: this.pests.length,
        livestockDiseases: this.livestockDiseases.length,
        plantingCalendars: this.plantingCalendars.length,
        soilTips: this.soilTips.length,
      });
    } catch (error) {
      logger.error('Error initializing data sources:', error);
      throw error;
    }
  }

  private async loadPests(): Promise<void> {
    try {
      const filePath = path.join(this.dataDir, 'pests.json');
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        this.pests = JSON.parse(content);
        logger.info(`Loaded ${this.pests.length} pest records`);
      } else {
        logger.warn(`Pests file not found: ${filePath}`);
      }
    } catch (error) {
      logger.error('Error loading pests:', error);
    }
  }

  private async loadLivestockDiseases(): Promise<void> {
    try {
      const filePath = path.join(this.dataDir, 'livestock-diseases.json');
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        this.livestockDiseases = JSON.parse(content);
        logger.info(`Loaded ${this.livestockDiseases.length} livestock disease records`);
      } else {
        logger.warn(`Livestock diseases file not found: ${filePath}`);
      }
    } catch (error) {
      logger.error('Error loading livestock diseases:', error);
    }
  }

  private async loadPlantingCalendars(): Promise<void> {
    try {
      const filePath = path.join(this.dataDir, 'planting-calendars.json');
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        this.plantingCalendars = JSON.parse(content);
        logger.info(`Loaded ${this.plantingCalendars.length} planting calendar records`);
      } else {
        logger.warn(`Planting calendars file not found: ${filePath}`);
      }
    } catch (error) {
      logger.error('Error loading planting calendars:', error);
    }
  }

  private async loadSoilTips(): Promise<void> {
    try {
      const filePath = path.join(this.dataDir, 'soil-tips.json');
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        this.soilTips = JSON.parse(content);
        logger.info(`Loaded ${this.soilTips.length} soil tip records`);
      } else {
        logger.warn(`Soil tips file not found: ${filePath}`);
      }
    } catch (error) {
      logger.error('Error loading soil tips:', error);
    }
  }

  // Search methods
  searchPests(query: string, crop?: string): PestData[] {
    if (!this.initialized) {
      logger.warn('Data sources not initialized');
      return [];
    }

    const lowerQuery = query.toLowerCase();
    const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 2); // Extract meaningful words
    
    return this.pests.filter(pest => {
      // More flexible matching - check if any query word matches pest data
      const pestText = `${pest.name} ${pest.symptoms} ${pest.control}`.toLowerCase();
      const matchesQuery = queryWords.length === 0 || 
        queryWords.some(word => pestText.includes(word)) ||
        pest.name.toLowerCase().includes(lowerQuery) ||
        pest.symptoms.toLowerCase().includes(lowerQuery) ||
        pest.control.toLowerCase().includes(lowerQuery);
      
      const matchesCrop = !crop || 
        pest.crop === 'general' || 
        pest.crop.toLowerCase() === crop.toLowerCase();
      
      return matchesQuery && matchesCrop;
    });
  }

  searchLivestockDiseases(query: string, livestockType?: string): LivestockDiseaseData[] {
    if (!this.initialized) {
      logger.warn('Data sources not initialized');
      return [];
    }

    const lowerQuery = query.toLowerCase();
    const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 2); // Extract meaningful words
    
    return this.livestockDiseases.filter(disease => {
      // More flexible matching - check if any query word matches disease data
      const diseaseText = `${disease.name} ${disease.symptoms} ${disease.treatment}`.toLowerCase();
      const matchesQuery = queryWords.length === 0 ||
        queryWords.some(word => diseaseText.includes(word)) ||
        disease.name.toLowerCase().includes(lowerQuery) ||
        disease.symptoms.toLowerCase().includes(lowerQuery) ||
        disease.treatment.toLowerCase().includes(lowerQuery);
      
      const matchesLivestock = !livestockType || 
        disease.livestock.toLowerCase().includes(livestockType.toLowerCase());
      
      return matchesQuery && matchesLivestock;
    });
  }

  getPlantingCalendar(county?: string): PlantingCalendarData | null {
    if (!this.initialized) {
      logger.warn('Data sources not initialized');
      return null;
    }

    if (!county) {
      return this.plantingCalendars[0] || null;
    }

    const lowerCounty = county.toLowerCase();
    return this.plantingCalendars.find(
      cal => cal.county.toLowerCase() === lowerCounty
    ) || null;
  }

  getAllPlantingCalendars(): PlantingCalendarData[] {
    if (!this.initialized) {
      logger.warn('Data sources not initialized');
      return [];
    }
    return this.plantingCalendars;
  }

  getSoilTips(): SoilTipData[] {
    if (!this.initialized) {
      logger.warn('Data sources not initialized');
      return [];
    }
    return this.soilTips;
  }

  // Format data for use in prompts
  formatPestData(pests: PestData[]): string {
    if (pests.length === 0) return '';
    
    return pests.map(pest => 
      `Pest: ${pest.name}\n` +
      `Crop: ${pest.crop}\n` +
      `Symptoms: ${pest.symptoms}\n` +
      `Control: ${pest.control}`
    ).join('\n\n');
  }

  formatLivestockDiseaseData(diseases: LivestockDiseaseData[]): string {
    if (diseases.length === 0) return '';
    
    return diseases.map(disease => 
      `Disease: ${disease.name}\n` +
      `Livestock: ${disease.livestock}\n` +
      `Symptoms: ${disease.symptoms}\n` +
      `Treatment: ${disease.treatment}`
    ).join('\n\n');
  }

  formatPlantingCalendar(calendar: PlantingCalendarData | null): string {
    if (!calendar) return '';
    
    return `County: ${calendar.county}\n` +
           `Recommended Crops: ${calendar.crops.join(', ')}\n` +
           `Long Rains: ${calendar.longRains}\n` +
           `Short Rains: ${calendar.shortRains}`;
  }

  formatSoilTips(tips: SoilTipData[]): string {
    if (tips.length === 0) return '';
    
    return tips.map(tip => 
      `${tip.title}: ${tip.description}`
    ).join('\n\n');
  }

  // Get all data as formatted strings for RAG
  getAllDataAsText(): string[] {
    const texts: string[] = [];

    // Add pest data
    if (this.pests.length > 0) {
      texts.push('PEST AND DISEASE INFORMATION:\n' + this.formatPestData(this.pests));
    }

    // Add livestock disease data
    if (this.livestockDiseases.length > 0) {
      texts.push('LIVESTOCK DISEASE INFORMATION:\n' + this.formatLivestockDiseaseData(this.livestockDiseases));
    }

    // Add planting calendar data
    if (this.plantingCalendars.length > 0) {
      const calendars = this.plantingCalendars.map(cal => this.formatPlantingCalendar(cal)).join('\n\n');
      texts.push('PLANTING CALENDAR INFORMATION:\n' + calendars);
    }

    // Add soil tips
    if (this.soilTips.length > 0) {
      texts.push('SOIL MANAGEMENT TIPS:\n' + this.formatSoilTips(this.soilTips));
    }

    return texts;
  }

  // Search all data sources for relevant information
  searchAll(query: string, context?: { crop?: string; region?: string; livestock?: string }): string[] {
    const results: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Search pests - always try if crop is mentioned or query has pest-related keywords
    const pestKeywords = ['pest', 'insect', 'worm', 'bug', 'damage', 'holes', 'leaf', 'symptom', 'disease'];
    const hasPestKeywords = pestKeywords.some(keyword => lowerQuery.includes(keyword));
    
    if (hasPestKeywords || context?.crop) {
      const relevantPests = this.searchPests(query, context?.crop);
      if (relevantPests.length > 0) {
        results.push('PEST INFORMATION:\n' + this.formatPestData(relevantPests));
      } else if (context?.crop) {
        // If crop is specified but no match, return all pests for that crop
        const allPestsForCrop = this.pests.filter(p => 
          p.crop === 'general' || (context.crop && p.crop.toLowerCase() === context.crop.toLowerCase())
        );
        if (allPestsForCrop.length > 0) {
          results.push('PEST INFORMATION:\n' + this.formatPestData(allPestsForCrop));
        }
      }
    }

    // Search livestock diseases - always try if livestock keywords present
    const livestockKeywords = ['cow', 'cattle', 'goat', 'sheep', 'chicken', 'poultry', 'livestock', 'animal', 'fever', 'symptom'];
    const hasLivestockKeywords = livestockKeywords.some(keyword => lowerQuery.includes(keyword));
    
    if (hasLivestockKeywords || context?.livestock) {
      const relevantDiseases = this.searchLivestockDiseases(query, context?.livestock);
      if (relevantDiseases.length > 0) {
        results.push('LIVESTOCK DISEASE INFORMATION:\n' + this.formatLivestockDiseaseData(relevantDiseases));
      } else if (context?.livestock) {
        // If livestock type specified but no match, return all diseases for that type
        const allDiseasesForLivestock = this.livestockDiseases.filter(d => 
          d.livestock.toLowerCase().includes(context.livestock!.toLowerCase())
        );
        if (allDiseasesForLivestock.length > 0) {
          results.push('LIVESTOCK DISEASE INFORMATION:\n' + this.formatLivestockDiseaseData(allDiseasesForLivestock));
        }
      }
    }

    // Check planting calendar - more flexible matching
    if (context?.region) {
      const calendar = this.getPlantingCalendar(context.region);
      if (calendar && (
        lowerQuery.includes('planting') || 
        lowerQuery.includes('calendar') || 
        lowerQuery.includes('season') ||
        lowerQuery.includes('rain') ||
        lowerQuery.includes('when') ||
        calendar.crops.some(c => lowerQuery.includes(c.toLowerCase()))
      )) {
        results.push('PLANTING CALENDAR:\n' + this.formatPlantingCalendar(calendar));
      }
    }

    // Check soil tips - more flexible matching
    const soilKeywords = ['soil', 'ph', 'erosion', 'organic', 'matter', 'fertility', 'nutrient'];
    if (soilKeywords.some(keyword => lowerQuery.includes(keyword))) {
      const tips = this.getSoilTips();
      if (tips.length > 0) {
        results.push('SOIL MANAGEMENT:\n' + this.formatSoilTips(tips));
      }
    }

    return results;
  }
}

export const dataSourceService = new DataSourceService();

