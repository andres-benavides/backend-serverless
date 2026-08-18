import { z } from 'zod';

export const decisionBodySchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
});
