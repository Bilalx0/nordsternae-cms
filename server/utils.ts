import { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';

export function validateBody<T>(schema: z.ZodType<T>, req: VercelRequest, res: VercelResponse): T | null {
  try {
    return schema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation failed', errors: error.errors });
    } else {
      res.status(400).json({ message: 'Invalid request data' });
    }
    return null;
  }
}