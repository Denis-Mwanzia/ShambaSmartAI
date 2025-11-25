import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string(),
  phoneNumber: z.string(),
  name: z.string().optional(),
  county: z.string().optional(),
  region: z.string().optional(),
  preferredLanguage: z.enum(['en', 'sw']).default('en'),
  crops: z.array(z.string()).default([]),
  livestock: z.array(z.string()).default([]),
  soilType: z.string().optional(),
  soilPH: z.number().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  locationUpdatedAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  metadata: z.record(z.any()).optional(),
});

export type User = z.infer<typeof UserSchema>;

export interface UserContext {
  user: User;
  crop?: string;
  region?: string;
  soilType?: string;
  farmStage?: 'planning' | 'planting' | 'growing' | 'harvesting' | 'post-harvest';
  intent?: string;
  coordinates?: { lat: number; lon: number };
}

