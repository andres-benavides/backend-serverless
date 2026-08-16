import { z } from 'zod';

export const createRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000),
  amount: z.number().positive(),
  requester: z.object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    email: z.string().email(),
  }),
  approvers: z.array(
    z.object({
      role: z.string().trim().min(1),
      name: z.string().trim().min(1),
      email: z.string().email(),
    })
  ).length(3),
}).superRefine((data, ctx) => {
  const roles = data.approvers.map((a) => a.role.toLowerCase());
  if (new Set(roles).size !== 3) {
    ctx.addIssue({
      code: 'custom',
      path: ['approvers'],
      message: 'The three approver roles must be different',
    });
  }

  const emails = data.approvers.map((a) => a.email.toLowerCase());
  if (new Set(emails).size !== 3) {
    ctx.addIssue({
      code: 'custom',
      path: ['approvers'],
      message: 'The three approvers must have different email addresses',
    });
  }
});
