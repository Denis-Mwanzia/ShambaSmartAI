import { z } from 'zod';

export const MessageSchema = z.object({
  id: z.string(),
  userId: z.string(),
  channel: z.enum(['whatsapp', 'sms', 'ussd', 'voice', 'web']),
  content: z.string(),
  direction: z.enum(['inbound', 'outbound']),
  timestamp: z.date(),
  metadata: z.record(z.any()).optional(),
});

export type Message = z.infer<typeof MessageSchema>;

export interface IncomingMessage {
  channel: 'whatsapp' | 'sms' | 'ussd' | 'voice' | 'web';
  from: string;
  content: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

