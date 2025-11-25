import { logger } from '../utils/logger';
import axios from 'axios';

export interface LocationData {
  latitude: number;
  longitude: number;
  county?: string;
  region?: string;
  address?: string;
}

/**
 * Reverse geocoding service to get county/region from coordinates
 */
export class LocationService {
  /**
   * Get county name from coordinates using reverse geocoding
   */
  async getCountyFromCoordinates(lat: number, lon: number): Promise<string | null> {
    try {
      // Try using Nominatim (OpenStreetMap) reverse geocoding
      const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: {
          lat,
          lon,
          format: 'json',
          addressdetails: 1,
        },
        headers: {
          'User-Agent': 'ShambaSmartAI/1.0',
        },
        timeout: 5000,
      });

      const address = response.data.address;
      if (address) {
        // Try to find county in address components
        const county = address.county || address.state_district || address.region || address.state;
        if (county) {
          // Map to Kenyan county names if needed
          return this.mapToKenyanCounty(county);
        }
      }

      // Fallback: Use coordinate-based mapping
      return this.getCountyFromCoordinatesMapping(lat, lon);
    } catch (error) {
      logger.warn('Error in reverse geocoding, using coordinate mapping:', error);
      return this.getCountyFromCoordinatesMapping(lat, lon);
    }
  }

  /**
   * Map coordinates to Kenyan county using approximate boundaries
   */
  private getCountyFromCoordinatesMapping(lat: number, lon: number): string {
    // Kenyan counties with approximate center coordinates
    const counties: Array<{ name: string; lat: number; lon: number; radius: number }> = [
      { name: 'Nairobi', lat: -1.2921, lon: 36.8219, radius: 0.5 },
      { name: 'Mombasa', lat: -4.0435, lon: 39.6682, radius: 0.5 },
      { name: 'Kisumu', lat: -0.0917, lon: 34.7680, radius: 0.8 },
      { name: 'Nakuru', lat: -0.3031, lon: 36.0800, radius: 0.8 },
      { name: 'Uasin Gishu', lat: 0.5143, lon: 35.2698, radius: 0.8 },
      { name: 'Kiambu', lat: -1.0332, lon: 37.0693, radius: 0.6 },
      { name: 'Nyeri', lat: -0.4197, lon: 36.9475, radius: 0.6 },
      { name: 'Meru', lat: 0.0463, lon: 37.6559, radius: 0.7 },
      { name: 'Embu', lat: -0.5397, lon: 37.4574, radius: 0.5 },
      { name: 'Machakos', lat: -1.5167, lon: 37.2667, radius: 0.6 },
      { name: 'Kakamega', lat: 0.2842, lon: 34.7523, radius: 0.7 },
      { name: 'Bungoma', lat: 0.5695, lon: 34.5584, radius: 0.6 },
      { name: 'Busia', lat: 0.4604, lon: 34.1115, radius: 0.5 },
      { name: 'Siaya', lat: 0.0607, lon: 34.2881, radius: 0.6 },
      { name: 'Homa Bay', lat: -0.5273, lon: 34.4571, radius: 0.6 },
      { name: 'Migori', lat: -1.0634, lon: 34.4731, radius: 0.6 },
      { name: 'Kisii', lat: -0.6773, lon: 34.7796, radius: 0.5 },
      { name: 'Nyamira', lat: -0.5639, lon: 34.9444, radius: 0.4 },
      { name: 'Kericho', lat: -0.3670, lon: 35.2831, radius: 0.6 },
      { name: 'Bomet', lat: -0.7814, lon: 35.3416, radius: 0.5 },
      { name: 'Narok', lat: -1.0808, lon: 35.8711, radius: 0.8 },
      { name: 'Kajiado', lat: -1.8524, lon: 36.7875, radius: 0.8 },
      { name: 'Makueni', lat: -1.8047, lon: 37.6204, radius: 0.6 },
      { name: 'Kitui', lat: -1.3669, lon: 38.0106, radius: 0.7 },
      { name: 'Garissa', lat: -0.4532, lon: 39.6464, radius: 0.8 },
      { name: 'Wajir', lat: 1.7474, lon: 40.0573, radius: 1.0 },
      { name: 'Mandera', lat: 3.9373, lon: 41.8569, radius: 1.0 },
      { name: 'Isiolo', lat: 0.3550, lon: 37.5836, radius: 0.7 },
      { name: 'Marsabit', lat: 2.3347, lon: 37.9903, radius: 1.0 },
      { name: 'Turkana', lat: 3.1167, lon: 35.6000, radius: 1.2 },
      { name: 'West Pokot', lat: 1.5167, lon: 35.0000, radius: 0.8 },
      { name: 'Samburu', lat: 1.1000, lon: 36.7167, radius: 0.8 },
      { name: 'Trans Nzoia', lat: 1.0167, lon: 35.0000, radius: 0.7 },
      { name: 'Elgeyo Marakwet', lat: 0.5167, lon: 35.5167, radius: 0.7 },
      { name: 'Nandi', lat: 0.1833, lon: 35.0000, radius: 0.6 },
      { name: 'Laikipia', lat: 0.0333, lon: 36.3667, radius: 0.8 },
      { name: 'Nyandarua', lat: -0.3000, lon: 36.4000, radius: 0.6 },
      { name: 'Murang\'a', lat: -0.7167, lon: 37.1500, radius: 0.6 },
      { name: 'Kirinyaga', lat: -0.5000, lon: 37.3333, radius: 0.5 },
      { name: 'Tharaka Nithi', lat: -0.3333, lon: 37.6500, radius: 0.5 },
    ];

    // Find closest county
    let closestCounty = counties[0];
    let minDistance = this.calculateDistance(lat, lon, closestCounty.lat, closestCounty.lon);

    for (const county of counties) {
      const distance = this.calculateDistance(lat, lon, county.lat, county.lon);
      if (distance < minDistance && distance <= county.radius) {
        minDistance = distance;
        closestCounty = county;
      }
    }

    return closestCounty.name;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Map external county names to Kenyan county names
   */
  private mapToKenyanCounty(countyName: string): string {
    const mapping: Record<string, string> = {
      'nairobi county': 'Nairobi',
      'mombasa county': 'Mombasa',
      'kisumu county': 'Kisumu',
      'nakuru county': 'Nakuru',
    };

    const lower = countyName.toLowerCase();
    return mapping[lower] || countyName;
  }
}

export const locationService = new LocationService();

