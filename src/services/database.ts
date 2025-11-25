import { Firestore } from '@google-cloud/firestore';
import { User } from '../models/user';
import { Message } from '../models/message';
import { Alert } from './alerts';
import { logger } from '../utils/logger';

export class DatabaseService {
  private db: Firestore;

  constructor() {
    const databaseId = process.env.FIRESTORE_DATABASE_ID;
    const config: any = {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      ignoreUndefinedProperties: true, // Ignore undefined values
    };
    
    // Only set databaseId if it's not '(default)' or empty
    if (databaseId && databaseId !== '(default)' && databaseId.trim() !== '') {
      config.databaseId = databaseId;
    }
    
    this.db = new Firestore(config);
  }

  // User operations
  async getUser(phoneNumber: string): Promise<User | null> {
    try {
      const usersRef = this.db.collection('users');
      const snapshot = await usersRef.where('phoneNumber', '==', phoneNumber).limit(1).get();
      
      if (snapshot.empty) return null;
      
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as User;
    } catch (error) {
      logger.error('Error getting user:', error);
      return null;
    }
  }

  async createUser(userData: Partial<User> & { phoneNumber: string }): Promise<User> {
    try {
      const usersRef = this.db.collection('users');
      const now = new Date();
      
      const user: Omit<User, 'id'> = {
        phoneNumber: userData.phoneNumber,
        preferredLanguage: userData.preferredLanguage || 'en',
        crops: userData.crops || [],
        livestock: userData.livestock || [],
        name: userData.name,
        county: userData.county,
        region: userData.region,
        soilType: userData.soilType,
        soilPH: userData.soilPH,
        latitude: userData.latitude,
        longitude: userData.longitude,
        locationUpdatedAt: userData.locationUpdatedAt,
        ...(userData.metadata && { metadata: userData.metadata }),
        createdAt: now,
        updatedAt: now,
      };
      
      const docRef = await usersRef.add(user);
      
      return { id: docRef.id, ...user };
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    try {
      const userRef = this.db.collection('users').doc(userId);
      await userRef.update({
        ...updates,
        updatedAt: new Date(),
      });
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  // Message operations
  async saveMessage(message: Partial<Message> & { userId: string; channel: Message['channel']; content: string; direction: Message['direction'] }): Promise<Message> {
    try {
      const messagesRef = this.db.collection('messages');
      const timestamp = new Date();
      
      // Build message data, only including metadata if it exists and is not undefined
      const messageData: any = {
        userId: message.userId,
        channel: message.channel,
        content: message.content,
        direction: message.direction,
        timestamp: message.timestamp || timestamp,
      };
      
      // Only add metadata if it exists and is not undefined
      if (message.metadata !== undefined && message.metadata !== null) {
        messageData.metadata = message.metadata;
      }
      
      const docRef = await messagesRef.add(messageData);
      
      return { id: docRef.id, ...messageData } as Message;
    } catch (error) {
      logger.error('Error saving message:', error);
      throw error;
    }
  }

  async getMessages(userId: string, limit: number = 50): Promise<Message[]> {
    try {
      const messagesRef = this.db.collection('messages');
      
      // Try to get messages with index, fallback to simple query if index doesn't exist
      try {
        const snapshot = await messagesRef
          .where('userId', '==', userId)
          .orderBy('timestamp', 'desc')
          .limit(limit)
          .get();
        
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Message[];
      } catch (indexError: any) {
        // If index error, try without orderBy
        if (indexError.code === 9 || indexError.message?.includes('index')) {
          logger.warn('Firestore index not found, using simple query:', indexError.message);
          const snapshot = await messagesRef
            .where('userId', '==', userId)
            .limit(limit)
            .get();
          
          // Sort in memory
          const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as Message[];
          
          return messages.sort((a, b) => {
            const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
            const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
            return bTime - aTime; // Descending order
          }).slice(0, limit);
        }
        throw indexError;
      }
    } catch (error) {
      logger.error('Error getting messages:', error);
      return [];
    }
  }

  // Alert operations
  async saveAlert(alert: Alert): Promise<void> {
    try {
      const alertsRef = this.db.collection('alerts');
      await alertsRef.add({
        ...alert,
        timestamp: alert.timestamp || new Date(),
      });
    } catch (error) {
      logger.error('Error saving alert:', error);
      throw error;
    }
  }

  // User query operations for alerts
  async getUserById(userId: string): Promise<User | null> {
    try {
      const userRef = this.db.collection('users').doc(userId);
      const doc = await userRef.get();
      
      if (!doc.exists) return null;
      
      return { id: doc.id, ...doc.data() } as User;
    } catch (error) {
      logger.error('Error getting user by ID:', error);
      return null;
    }
  }

  async getUsersByRegion(region: string): Promise<User[]> {
    try {
      const usersRef = this.db.collection('users');
      const snapshot = await usersRef
        .where('county', '==', region)
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as User[];
    } catch (error) {
      logger.error('Error getting users by region:', error);
      return [];
    }
  }

  async getUsersByCrops(crops: string[]): Promise<User[]> {
    try {
      const usersRef = this.db.collection('users');
      const allUsers: User[] = [];
      
      // Firestore doesn't support array-contains-any with multiple values easily
      // So we'll get all users and filter in memory (for small datasets)
      // In production, would use array-contains for single crop or paginate
      const snapshot = await usersRef.get();
      
      snapshot.docs.forEach(doc => {
        const user = { id: doc.id, ...doc.data() } as User;
        if (user.crops && user.crops.some(crop => 
          crops.some(searchCrop => 
            crop.toLowerCase().includes(searchCrop.toLowerCase()) ||
            searchCrop.toLowerCase().includes(crop.toLowerCase())
          )
        )) {
          allUsers.push(user);
        }
      });
      
      return allUsers;
    } catch (error) {
      logger.error('Error getting users by crops:', error);
      return [];
    }
  }

  async getUsersWithCrops(): Promise<User[]> {
    try {
      const usersRef = this.db.collection('users');
      const snapshot = await usersRef.get();
      
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as User))
        .filter(user => user.crops && user.crops.length > 0);
    } catch (error) {
      logger.error('Error getting users with crops:', error);
      return [];
    }
  }

  async getUniqueRegions(): Promise<string[]> {
    try {
      const usersRef = this.db.collection('users');
      const snapshot = await usersRef.get();
      
      const regions = new Set<string>();
      snapshot.docs.forEach(doc => {
        const user = doc.data() as User;
        if (user.county) {
          regions.add(user.county);
        }
        if (user.region) {
          regions.add(user.region);
        }
      });
      
      return Array.from(regions);
    } catch (error) {
      logger.error('Error getting unique regions:', error);
      // Return default regions if query fails
      return ['Nairobi', 'Nakuru', 'Kisumu', 'Mombasa'];
    }
  }
}

export const databaseService = new DatabaseService();

