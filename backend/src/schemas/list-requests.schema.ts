import { z } from 'zod';

export const listRequestsQuerySchema = z.object({
  requesterId: z.string().trim().min(1).max(200),
});
