import { databaseService } from './database';
import { weatherService, WeatherForecast } from './weather';
import { marketService } from './market';
import { logger } from '../utils/logger';
import { SMSChannel } from '../channels/sms';
import { WhatsAppChannel } from '../channels/whatsapp';

export interface Alert {
  id: string;
  userId: string;
  type: 'weather' | 'pest' | 'market' | 'general';
  severity: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class AlertService {
  async checkAndSendAlerts(): Promise<void> {
    try {
      // Get all users (in production, would paginate)
      // For now, we'll check alerts for active users
      
      // Weather alerts
      await this.checkWeatherAlerts();
      
      // Pest outbreak alerts
      await this.checkPestAlerts();
      
      // Market price alerts
      await this.checkMarketAlerts();
    } catch (error) {
      logger.error('Error checking alerts:', error);
    }
  }

  private async checkWeatherAlerts(): Promise<void> {
    logger.info('Checking weather alerts...');
    
    try {
      // Get all unique regions from users
      const regions = await databaseService.getUniqueRegions();
      
      for (const region of regions) {
        try {
          const forecast = await weatherService.getForecast(region);
          
          if (forecast.alerts && forecast.alerts.length > 0) {
            // Send alerts to users in this region
            await this.sendWeatherAlertsToRegion(region, forecast.alerts);
          }
        } catch (error) {
          logger.warn(`Failed to check weather for region ${region}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error checking weather alerts:', error);
    }
  }

  private async checkPestAlerts(): Promise<void> {
    logger.info('Checking pest alerts...');
    
    try {
      // Known pest outbreaks (in production, this would come from monitoring systems)
      const pestOutbreaks: Array<{
        pest: string;
        crops: string[];
        regions: string[];
        severity: 'high' | 'medium' | 'low';
        message: string;
      }> = [
        {
          pest: 'Fall Armyworm',
          crops: ['maize', 'sorghum'],
          regions: [], // Empty means all regions
          severity: 'high',
          message: 'Fall Armyworm outbreak detected. Monitor your maize fields closely and apply control measures immediately.',
        },
        {
          pest: 'Tuta absoluta',
          crops: ['tomato'],
          regions: [],
          severity: 'high',
          message: 'Tuta absoluta (tomato leaf miner) outbreak detected. Check your tomato plants and apply appropriate pesticides.',
        },
      ];
      
      for (const outbreak of pestOutbreaks) {
        // Get users growing affected crops
        const users = await databaseService.getUsersByCrops(outbreak.crops);
        
        for (const user of users) {
          // Check if user's region is affected (or all regions if empty)
          if (outbreak.regions.length === 0 || 
              (user.county && outbreak.regions.includes(user.county.toLowerCase()))) {
            await this.sendAlert(user.id, {
              type: 'pest',
              severity: outbreak.severity,
              title: `${outbreak.pest} Alert`,
              message: outbreak.message,
              metadata: {
                pest: outbreak.pest,
                crops: outbreak.crops,
              },
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error checking pest alerts:', error);
    }
  }

  private async checkMarketAlerts(): Promise<void> {
    logger.info('Checking market alerts...');
    
    try {
      // Get all users with crops
      const users = await databaseService.getUsersWithCrops();
      
      for (const user of users) {
        if (!user.crops || user.crops.length === 0) continue;
        
        for (const crop of user.crops) {
          try {
            const region = user.county || 'Kenya';
            const prices = await marketService.getPrices(crop, region);
            
            if (prices.length > 0) {
              // Check for significant price changes (20% threshold)
              const currentPrice = prices[0];
              const previousPrice = prices.find(p => p.date !== currentPrice.date);
              
              if (previousPrice && currentPrice.trend) {
                const priceChange = Math.abs(
                  ((currentPrice.price - previousPrice.price) / previousPrice.price) * 100
                );
                
                if (priceChange >= 20) {
                  const trend = currentPrice.trend === 'up' ? 'increased' : 'decreased';
                  await this.sendAlert(user.id, {
                    type: 'market',
                    severity: priceChange >= 30 ? 'high' : 'medium',
                    title: `${crop} Price Alert`,
                    message: `${crop} prices have ${trend} by ${priceChange.toFixed(1)}% in ${region}. Current price: KES ${currentPrice.price}/${currentPrice.unit}`,
                    metadata: {
                      crop,
                      region,
                      currentPrice: currentPrice.price,
                      previousPrice: previousPrice.price,
                      change: priceChange,
                    },
                  });
                }
              }
            }
          } catch (error) {
            logger.warn(`Failed to check market prices for user ${user.id}, crop ${crop}:`, error);
          }
        }
      }
    } catch (error) {
      logger.error('Error checking market alerts:', error);
    }
  }

  private async sendWeatherAlertsToRegion(
    region: string,
    alerts: WeatherForecast['alerts']
  ): Promise<void> {
    if (!alerts || alerts.length === 0) return;
    
    try {
      // Get users in this region
      const users = await databaseService.getUsersByRegion(region);
      
      for (const user of users) {
        for (const alert of alerts) {
          await this.sendAlert(user.id, {
            type: 'weather',
            severity: alert.severity,
            title: `Weather Alert: ${region}`,
            message: alert.message,
            metadata: {
              region,
              alertType: alert.type,
            },
          });
        }
      }
      
      logger.info(`Sent ${alerts.length} weather alerts to ${users.length} users in ${region}`);
    } catch (error) {
      logger.error(`Error sending weather alerts to region ${region}:`, error);
    }
  }

  async sendAlert(
    userId: string,
    alert: Omit<Alert, 'id' | 'userId' | 'timestamp'>
  ): Promise<void> {
    try {
      const user = await databaseService.getUserById(userId);
      if (!user || !user.phoneNumber) {
        logger.warn(`User ${userId} not found or has no phone number for alert`);
        return;
      }
      
      // Save alert to database
      const alertData: Alert = {
        id: `${userId}-${Date.now()}`,
        userId,
        ...alert,
        timestamp: new Date(),
      };
      
      await databaseService.saveAlert(alertData);
      
      // Send via user's preferred channel
      const message = `${alert.title}\n\n${alert.message}`;
      
      // Try WhatsApp first if available, then SMS
      try {
        const whatsappChannel = new WhatsAppChannel();
        await whatsappChannel.sendMessage(user.phoneNumber, message);
        logger.info(`Alert sent via WhatsApp to user ${userId}: ${alert.title}`);
      } catch (whatsappError) {
        // Fallback to SMS
        try {
          const smsChannel = new SMSChannel();
          await smsChannel.sendMessage(user.phoneNumber, message);
          logger.info(`Alert sent via SMS to user ${userId}: ${alert.title}`);
        } catch (smsError) {
          logger.error(`Failed to send alert to user ${userId} via both channels:`, { whatsappError, smsError });
        }
      }
    } catch (error) {
      logger.error('Error sending alert:', error);
    }
  }
}

export const alertService = new AlertService();

// Scheduled job to check alerts (would run via Cloud Scheduler or similar)
export function startAlertScheduler(): void {
  // Check alerts every hour
  setInterval(() => {
    alertService.checkAndSendAlerts();
  }, 60 * 60 * 1000);
  
  // Also check immediately on startup
  alertService.checkAndSendAlerts();
}

