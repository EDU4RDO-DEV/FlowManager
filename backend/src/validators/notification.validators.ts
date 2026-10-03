import { z } from 'zod';

export const testNotificationBodySchema = z.object({
  titulo: z.string().trim().min(1, 'titulo no puede ir vacío').max(255, 'titulo demasiado largo').optional(),
  mensaje: z.string().trim().min(1, 'mensaje no puede ir vacío').max(500, 'mensaje demasiado largo').optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
