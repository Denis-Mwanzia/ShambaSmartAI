import axios from 'axios';
import { logger } from '../utils/logger';

export interface WeatherForecast {
  location: string;
  current: {
    temperature: number;
    humidity: number;
    precipitation: number;
    condition: string;
  };
  forecast: Array<{
    date: string;
    temperature: { min: number; max: number };
    precipitation: number;
    condition: string;
  }>;
  alerts?: Array<{
    type: 'drought' | 'flood' | 'heat' | 'frost';
    severity: 'low' | 'medium' | 'high';
    message: string;
  }>;
}

// County to coordinates mapping (Kenya)
const COUNTY_COORDINATES: Record<string, { lat: number; lon: number }> = {
  'Nairobi': { lat: -1.2921, lon: 36.8219 },
  'Mombasa': { lat: -4.0435, lon: 39.6682 },
  'Kisumu': { lat: -0.0917, lon: 34.7680 },
  'Nakuru': { lat: -0.3031, lon: 36.0800 },
  'Eldoret': { lat: 0.5143, lon: 35.2698 },
  'Thika': { lat: -1.0332, lon: 37.0693 },
  // Add more counties as needed
};

export class WeatherService {
  private apiUrl = process.env.OPEN_METEO_API_URL || 'https://api.open-meteo.com/v1';

  async getForecast(location: string): Promise<WeatherForecast> {
    try {
      const coords = this.getCoordinates(location);
      
      // Fetch from Open-Meteo (correct endpoint)
      const response = await axios.get(`${this.apiUrl}/forecast`, {
        params: {
          latitude: coords.lat,
          longitude: coords.lon,
          current: ['temperature_2m', 'relative_humidity_2m', 'precipitation', 'weather_code'].join(','),
          daily: ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'weather_code'].join(','),
          timezone: 'Africa/Nairobi',
          forecast_days: 7,
        },
        timeout: 10000, // 10 second timeout
      });

      const data = response.data;
      
      // Generate alerts
      const alerts = this.generateAlerts(data);
      
      return {
        location,
        current: {
          temperature: data.current.temperature_2m,
          humidity: data.current.relative_humidity_2m,
          precipitation: data.current.precipitation || 0,
          condition: this.getWeatherCondition(data.current.weather_code),
        },
        forecast: data.daily.time.map((date: string, i: number) => ({
          date,
          temperature: {
            min: data.daily.temperature_2m_min[i],
            max: data.daily.temperature_2m_max[i],
          },
          precipitation: data.daily.precipitation_sum[i] || 0,
          condition: this.getWeatherCondition(data.daily.weather_code[i]),
        })),
        alerts,
      };
    } catch (error) {
      logger.error('Error fetching weather forecast:', error);
      // Return default forecast
      return this.getDefaultForecast(location);
    }
  }

  private getCoordinates(location: string): { lat: number; lon: number } {
    // Try to find in mapping
    const county = Object.keys(COUNTY_COORDINATES).find(
      c => location.toLowerCase().includes(c.toLowerCase())
    );
    
    if (county) {
      return COUNTY_COORDINATES[county];
    }
    
    // Default to Nairobi
    return COUNTY_COORDINATES['Nairobi'];
  }

  private getWeatherCondition(code: number): string {
    // WMO Weather interpretation codes
    const conditions: Record<number, string> = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      71: 'Slight snow',
      73: 'Moderate snow',
      75: 'Heavy snow',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with slight hail',
      99: 'Thunderstorm with heavy hail',
    };
    
    return conditions[code] || 'Unknown';
  }

  private generateAlerts(data: any): WeatherForecast['alerts'] {
    const alerts: WeatherForecast['alerts'] = [];
    
    // Check for drought (low precipitation)
    const avgPrecipitation = data.daily.precipitation_sum
      .slice(0, 7)
      .reduce((a: number, b: number) => a + b, 0) / 7;
    
    if (avgPrecipitation < 1) {
      alerts.push({
        type: 'drought',
        severity: avgPrecipitation < 0.5 ? 'high' : 'medium',
        message: 'Low rainfall expected. Consider water conservation measures.',
      });
    }
    
    // Check for heat stress
    const maxTemp = Math.max(...data.daily.temperature_2m_max.slice(0, 7));
    if (maxTemp > 35) {
      alerts.push({
        type: 'heat',
        severity: maxTemp > 38 ? 'high' : 'medium',
        message: 'High temperatures expected. Protect crops and livestock from heat stress.',
      });
    }
    
    // Check for heavy rain
    const maxPrecipitation = Math.max(...data.daily.precipitation_sum.slice(0, 7));
    if (maxPrecipitation > 50) {
      alerts.push({
        type: 'flood',
        severity: maxPrecipitation > 100 ? 'high' : 'medium',
        message: 'Heavy rainfall expected. Take flood prevention measures.',
      });
    }
    
    return alerts;
  }

  private getDefaultForecast(location: string): WeatherForecast {
    return {
      location,
      current: {
        temperature: 25,
        humidity: 60,
        precipitation: 0,
        condition: 'Partly cloudy',
      },
      forecast: [],
    };
  }
}

export const weatherService = new WeatherService();

