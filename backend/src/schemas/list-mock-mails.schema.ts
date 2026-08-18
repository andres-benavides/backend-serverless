import { z } from 'zod';

export const listMockMailsQuerySchema = z.object({
  requestId: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
