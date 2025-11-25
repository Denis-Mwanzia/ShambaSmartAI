import axios from 'axios';
import { logger } from '../utils/logger';

export interface MarketPrice {
  crop: string;
  region: string;
  price: number;
  unit: string;
  date: string;
  market?: string;
  trend?: 'up' | 'down' | 'stable';
}

export class MarketService {
  private knbsApiUrl = process.env.KNBS_API_URL || 'https://statistics.knbs.or.ke/api';
  private hcdApiUrl = process.env.HCD_API_URL || 'https://hcd.go.ke/api';

  async getPrices(crop: string, region: string): Promise<MarketPrice[]> {
    try {
      // Try to fetch from KNBS API
      const prices = await this.fetchFromKNBS(crop, region);
      if (prices.length > 0) return prices;
      
      // Fallback to HCD API
      return await this.fetchFromHCD(crop, region);
    } catch (error) {
      logger.error('Error fetching market prices:', error);
      return this.getDefaultPrices(crop, region);
    }
  }

  private async fetchFromKNBS(crop: string, region: string): Promise<MarketPrice[]> {
    try {
      // This is a placeholder - actual API endpoint would need to be configured
      const response = await axios.get(`${this.knbsApiUrl}/prices`, {
        params: {
          commodity: crop,
          region,
        },
      });
      
      return response.data.map((item: any) => ({
        crop,
        region,
        price: item.price,
        unit: item.unit || 'kg',
        date: item.date,
        market: item.market,
        trend: this.calculateTrend(item.historical),
      }));
    } catch (error) {
      logger.warn('KNBS API not available, using fallback');
      return [];
    }
  }

  private async fetchFromHCD(crop: string, region: string): Promise<MarketPrice[]> {
    try {
      // This is a placeholder - actual API endpoint would need to be configured
      const response = await axios.get(`${this.hcdApiUrl}/prices`, {
        params: {
          crop,
          region,
        },
      });
      
      return response.data.map((item: any) => ({
        crop,
        region,
        price: item.price,
        unit: item.unit || 'kg',
        date: item.date,
        market: item.market,
      }));
    } catch (error) {
      logger.warn('HCD API not available, using fallback');
      return [];
    }
  }

  private calculateTrend(historical: number[]): 'up' | 'down' | 'stable' {
    if (!historical || historical.length < 2) return 'stable';
    
    const recent = historical.slice(-3);
    const older = historical.slice(-6, -3);
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (change > 5) return 'up';
    if (change < -5) return 'down';
    return 'stable';
  }

  private getDefaultPrices(crop: string, region: string): MarketPrice[] {
    // Default prices (Kenyan Shillings per kg) - these should be updated with real data
    const defaultPrices: Record<string, number> = {
      'maize': 45,
      'wheat': 55,
      'rice': 120,
      'beans': 150,
      'potatoes': 60,
      'tomatoes': 80,
      'onions': 100,
      'cabbage': 40,
    };
    
    return [{
      crop,
      region,
      price: defaultPrices[crop.toLowerCase()] || 50,
      unit: 'kg',
      date: new Date().toISOString(),
      trend: 'stable',
    }];
  }
}

export const marketService = new MarketService();

