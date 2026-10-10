import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { getDashboardData } from '../services/dashboard.service';
import { dashboardQuerySchema } from '../validators/dashboard.validators';
import { getZodErrorMessage } from '../validators/validation';

export async function getDashboardController(req: Request, res: Response) {
  try {
    const query = dashboardQuerySchema.parse(req.query);
    const data = await getDashboardData(query);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ ok: false, message: getZodErrorMessage(error) });
    }
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}
