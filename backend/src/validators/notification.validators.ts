import { z } from 'zod';

export const testNotificationBodySchema = z.object({
  datos: z.record(z.string(), z.unknown()).optional(),
});
