import { z } from 'zod';

export const approvalTokenParamsSchema = z.object({
  approvalToken: z.string().trim().uuid(),
});
