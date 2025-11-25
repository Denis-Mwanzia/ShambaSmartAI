import axios from 'axios';
import { logger } from '../utils/logger';

export interface FAOSTATData {
  domain: string;
  area: string;
  element: string;
  item: string;
  year: number;
  value: number;
  unit: string;
}

export interface FAOSTATQuery {
  domain?: string; // e.g., 'QC' (Crops), 'QL' (Livestock), 'PP' (Prices)
  area?: string; // Country code, e.g., '114' for Kenya
  item?: string; // Commodity code
  element?: string; // Element code (production, yield, etc.)
  year?: number;
}

export class FAOSTATService {
  private baseUrl = 'https://fenixservices.fao.org/faostat/api/v1/en';
  private dataUrl = 'https://fenixservices.fao.org/faostat/api/v1/en/data';

  /**
   * Get available domains (data categories)
   */
  async getDomains(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/domains`, {
        timeout: 10000,
      });
      return response.data?.data?.map((d: any) => d.domain_code) || [];
    } catch (error: any) {
      logger.warn('Error fetching FAOSTAT domains:', error.message);
      return [];
    }
  }

  /**
   * Get data for Kenya
   */
  async getKenyaData(query: FAOSTATQuery = {}): Promise<FAOSTATData[]> {
    try {
      const params: any = {
        area: query.area || '114', // Kenya country code
        output_format: 'json',
        show_codes: true,
        show_unit: true,
      };

      if (query.domain) params.domain_code = query.domain;
      if (query.item) params.item_code = query.item;
      if (query.element) params.element_code = query.element;
      if (query.year) params.year = query.year;

      const response = await axios.get(this.dataUrl, {
        params,
        timeout: 15000,
      });

      // FAOSTAT returns data in a specific format
      const data = response.data?.data || [];
      
      return data.map((item: any) => ({
        domain: item.domain_code || query.domain || '',
        area: item.area || 'Kenya',
        element: item.element || '',
        item: item.item || '',
        year: parseInt(item.year) || new Date().getFullYear() - 1,
        value: parseFloat(item.value) || 0,
        unit: item.unit || '',
      }));
    } catch (error: any) {
      logger.warn('Error fetching FAOSTAT data:', error.message);
      return [];
    }
  }

  /**
   * Get crop production data for Kenya
   */
  async getCropProduction(crop?: string, year?: number): Promise<FAOSTATData[]> {
    return this.getKenyaData({
      domain: 'QC', // Crops domain
      item: crop,
      element: '5510', // Production quantity
      year,
    });
  }

  /**
   * Get crop yield data for Kenya
   */
  async getCropYield(crop?: string, year?: number): Promise<FAOSTATData[]> {
    return this.getKenyaData({
      domain: 'QC', // Crops domain
      item: crop,
      element: '5419', // Yield
      year,
    });
  }

  /**
   * Get livestock production data
   */
  async getLivestockProduction(livestock?: string, year?: number): Promise<FAOSTATData[]> {
    return this.getKenyaData({
      domain: 'QL', // Livestock domain
      item: livestock,
      element: '5510', // Production quantity
      year,
    });
  }

  /**
   * Get market prices data
   */
  async getMarketPrices(commodity?: string, year?: number): Promise<FAOSTATData[]> {
    return this.getKenyaData({
      domain: 'PP', // Producer Prices domain
      item: commodity,
      year,
    });
  }

  /**
   * Format FAOSTAT data for use in AI prompts
   */
  formatForPrompt(data: FAOSTATData[]): string {
    if (data.length === 0) return '';

    let text = 'FAOSTAT Agricultural Statistics (Kenya):\n\n';
    
    // Group by item
    const grouped = data.reduce((acc: Record<string, FAOSTATData[]>, item) => {
      const key = item.item || 'Unknown';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    Object.entries(grouped).forEach(([item, items]) => {
      text += `${item}:\n`;
      items.forEach(d => {
        text += `  - ${d.element} (${d.year}): ${d.value} ${d.unit}\n`;
      });
      text += '\n';
    });

    return text;
  }

  /**
   * Get common crops for Kenya
   */
  async getCommonCrops(): Promise<string[]> {
    try {
      // Get recent production data to identify common crops
      const data = await this.getCropProduction(undefined, new Date().getFullYear() - 1);
      const crops = [...new Set(data.map(d => d.item))].filter(Boolean);
      return crops.slice(0, 20); // Top 20 crops
    } catch (error) {
      logger.warn('Error getting common crops, using defaults:', error);
      // Return default common crops for Kenya
      return [
        'Maize',
        'Wheat',
        'Rice',
        'Potatoes',
        'Beans',
        'Tomatoes',
        'Bananas',
        'Coffee',
        'Tea',
        'Sugarcane',
      ];
    }
  }
}

export const faostatService = new FAOSTATService();

