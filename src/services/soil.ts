import axios from 'axios';
import { logger } from '../utils/logger';

export interface SoilProperties {
  location: string;
  coordinates: { lat: number; lon: number };
  ph?: number;
  organicCarbon?: number;
  bulkDensity?: number;
  clay?: number;
  sand?: number;
  silt?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  depth?: string;
}

export interface SoilRecommendation {
  property: string;
  value: number;
  status: 'optimal' | 'low' | 'high' | 'critical';
  recommendation: string;
}

export class SoilService {
  private apiUrl = 'https://rest.isric.org/soilgrids/v2.0';

  /**
   * Get soil properties for a given location
   */
  async getSoilProperties(location: string, coordinates?: { lat: number; lon: number }): Promise<SoilProperties> {
    try {
      const coords = coordinates || this.getCoordinates(location);
      
      // Fetch multiple soil properties in parallel
      const [phData, ocData, bdData, textureData] = await Promise.all([
        this.fetchProperty('phh2o', coords, '0-5cm'),
        this.fetchProperty('ocd', coords, '0-5cm'),
        this.fetchProperty('bdfie', coords, '0-5cm'),
        this.fetchProperty('texture', coords, '0-5cm'),
      ]);

      const soilProperties: SoilProperties = {
        location,
        coordinates: coords,
        depth: '0-5cm',
      };

      // Extract pH - API returns data in different format
      if (phData?.properties) {
        const phValue = phData.properties.phh2o?.mean || phData.properties.mean;
        if (phValue) {
          soilProperties.ph = typeof phValue === 'number' ? phValue / 10 : parseFloat(phValue) / 10;
        }
      }

      // Extract Organic Carbon (g/kg)
      if (ocData?.properties) {
        const ocValue = ocData.properties.ocd?.mean || ocData.properties.mean;
        if (ocValue) {
          soilProperties.organicCarbon = typeof ocValue === 'number' ? ocValue : parseFloat(ocValue);
        }
      }

      // Extract Bulk Density (kg/dm³)
      if (bdData?.properties) {
        const bdValue = bdData.properties.bdfie?.mean || bdData.properties.mean;
        if (bdValue) {
          soilProperties.bulkDensity = typeof bdValue === 'number' ? bdValue / 100 : parseFloat(bdValue) / 100;
        }
      }

      // Extract texture components (if available)
      if (textureData?.properties) {
        // Texture data might be in different format
        // This is a placeholder - actual texture extraction depends on API response
      }

      logger.info('Fetched soil properties', { location, ph: soilProperties.ph, oc: soilProperties.organicCarbon });

      return soilProperties;
    } catch (error: any) {
      logger.error('Error fetching soil properties:', error);
      // Return default properties
      return this.getDefaultProperties(location, coordinates);
    }
  }

  /**
   * Fetch a specific soil property from ISRIC SoilGrids API
   */
  private async fetchProperty(
    property: string,
    coordinates: { lat: number; lon: number },
    depth: string = '0-5cm'
  ): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/properties/query`, {
        params: {
          lon: coordinates.lon,
          lat: coordinates.lat,
          property,
          depth,
          value: 'mean',
        },
        timeout: 10000,
      });

      return response.data;
    } catch (error: any) {
      logger.warn(`Error fetching soil property ${property}:`, error.message);
      return null;
    }
  }

  /**
   * Get soil recommendations based on properties
   */
  getRecommendations(soil: SoilProperties, _crop?: string): SoilRecommendation[] {
    const recommendations: SoilRecommendation[] = [];

    // pH recommendations (most crops prefer 6.0-7.0)
    if (soil.ph !== undefined) {
      let status: 'optimal' | 'low' | 'high' | 'critical';
      let recommendation: string;

      if (soil.ph < 5.0) {
        status = 'critical';
        recommendation = 'Soil is very acidic. Apply agricultural lime (2-4 tons/hectare) to raise pH. Test soil after 3-6 months.';
      } else if (soil.ph < 6.0) {
        status = 'low';
        recommendation = 'Soil is slightly acidic. Apply lime (1-2 tons/hectare) to raise pH to optimal range (6.0-7.0).';
      } else if (soil.ph > 7.5) {
        status = 'high';
        recommendation = 'Soil is alkaline. Consider adding organic matter or sulfur to lower pH if needed for specific crops.';
      } else {
        status = 'optimal';
        recommendation = 'Soil pH is in optimal range for most crops. Maintain with regular organic matter additions.';
      }

      recommendations.push({
        property: 'pH',
        value: soil.ph,
        status,
        recommendation,
      });
    }

    // Organic Carbon recommendations (aim for 2-4%)
    if (soil.organicCarbon !== undefined) {
      const ocPercent = (soil.organicCarbon / 10); // Convert g/kg to %
      let status: 'optimal' | 'low' | 'high' | 'critical';
      let recommendation: string;

      if (ocPercent < 1.0) {
        status = 'critical';
        recommendation = 'Very low organic matter. Add 10-20 tons/hectare of compost or well-rotted manure. Plant cover crops.';
      } else if (ocPercent < 2.0) {
        status = 'low';
        recommendation = 'Low organic matter. Add 5-10 tons/hectare of organic matter. Incorporate crop residues.';
      } else if (ocPercent > 5.0) {
        status = 'high';
        recommendation = 'High organic matter. Excellent for soil health. Maintain with regular additions.';
      } else {
        status = 'optimal';
        recommendation = 'Organic matter is in good range. Maintain with regular compost additions and crop residue incorporation.';
      }

      recommendations.push({
        property: 'Organic Carbon',
        value: ocPercent,
        status,
        recommendation,
      });
    }

    // Bulk Density recommendations (optimal: 1.1-1.4 g/cm³)
    if (soil.bulkDensity !== undefined) {
      let status: 'optimal' | 'low' | 'high' | 'critical';
      let recommendation: string;

      if (soil.bulkDensity > 1.6) {
        status = 'critical';
        recommendation = 'Very high bulk density indicates compaction. Deep tillage, add organic matter, avoid heavy machinery.';
      } else if (soil.bulkDensity > 1.4) {
        status = 'high';
        recommendation = 'High bulk density. Add organic matter, practice minimum tillage, use cover crops to improve structure.';
      } else if (soil.bulkDensity < 1.0) {
        status = 'low';
        recommendation = 'Low bulk density (very loose). May need slight compaction for seed establishment.';
      } else {
        status = 'optimal';
        recommendation = 'Bulk density is optimal. Maintain with organic matter and proper tillage practices.';
      }

      recommendations.push({
        property: 'Bulk Density',
        value: soil.bulkDensity,
        status,
        recommendation,
      });
    }

    return recommendations;
  }

  /**
   * Get coordinates for a location
   */
  private getCoordinates(location: string): { lat: number; lon: number } {
    // County to coordinates mapping (Kenya)
    const COUNTY_COORDINATES: Record<string, { lat: number; lon: number }> = {
      'Nairobi': { lat: -1.2921, lon: 36.8219 },
      'Mombasa': { lat: -4.0435, lon: 39.6682 },
      'Kisumu': { lat: -0.0917, lon: 34.7680 },
      'Nakuru': { lat: -0.3031, lon: 36.0800 },
      'Eldoret': { lat: 0.5143, lon: 35.2698 },
      'Thika': { lat: -1.0332, lon: 37.0693 },
      'Nyeri': { lat: -0.4197, lon: 36.9475 },
      'Meru': { lat: 0.0463, lon: 37.6559 },
      'Embu': { lat: -0.5397, lon: 37.4574 },
      'Machakos': { lat: -1.5167, lon: 37.2667 },
    };

    const county = Object.keys(COUNTY_COORDINATES).find(
      c => location.toLowerCase().includes(c.toLowerCase())
    );

    return county ? COUNTY_COORDINATES[county] : COUNTY_COORDINATES['Nairobi'];
  }

  /**
   * Get default soil properties when API fails
   */
  private getDefaultProperties(location: string, coordinates?: { lat: number; lon: number }): SoilProperties {
    return {
      location,
      coordinates: coordinates || this.getCoordinates(location),
      ph: 6.5, // Default neutral pH
      organicCarbon: 20, // Default 2% organic carbon
      bulkDensity: 1.3, // Default optimal bulk density
    };
  }

  /**
   * Format soil properties for use in AI prompts
   */
  formatForPrompt(soil: SoilProperties, recommendations?: SoilRecommendation[]): string {
    let text = `Soil Properties for ${soil.location}:\n`;
    
    if (soil.ph !== undefined) {
      text += `- pH: ${soil.ph.toFixed(1)} (${this.getPhStatus(soil.ph)})\n`;
    }
    if (soil.organicCarbon !== undefined) {
      text += `- Organic Carbon: ${(soil.organicCarbon / 10).toFixed(1)}%\n`;
    }
    if (soil.bulkDensity !== undefined) {
      text += `- Bulk Density: ${soil.bulkDensity.toFixed(2)} g/cm³\n`;
    }

    if (recommendations && recommendations.length > 0) {
      text += `\nRecommendations:\n`;
      recommendations.forEach(rec => {
        text += `- ${rec.property}: ${rec.recommendation}\n`;
      });
    }

    return text;
  }

  private getPhStatus(ph: number): string {
    if (ph < 5.0) return 'Very Acidic';
    if (ph < 6.0) return 'Acidic';
    if (ph > 7.5) return 'Alkaline';
    return 'Optimal';
  }
}

export const soilService = new SoilService();

