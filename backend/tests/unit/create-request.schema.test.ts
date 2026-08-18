import { describe, expect, it } from 'vitest';
import { createRequestSchema } from '../../src/schemas/create-request.schema';

const validInput = () => ({
  title: 'Compra de portátiles',
  description: 'Tres equipos para el equipo de desarrollo',
  amount: 15000000,
  requester: {
    id: 'user-001',
    name: 'Solicitante Demo',
    email: 'requester@example.com',
  },
  approvers: [
    { role: 'Manager', name: 'Approver One', email: 'one@example.com' },
    { role: 'Finance', name: 'Approver Two', email: 'two@example.com' },
    { role: 'Director', name: 'Approver Three', email: 'three@example.com' },
  ],
});

describe('createRequestSchema', () => {
  it('accepts a valid purchase request', () => {
    const result = createRequestSchema.safeParse(validInput());

    expect(result.success).toBe(true);
  });

  it('rejects an empty title', () => {
    const input = { ...validInput(), title: '' };

    const result = createRequestSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it('rejects a non positive amount', () => {
    const input = { ...validInput(), amount: 0 };

    const result = createRequestSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it('rejects an invalid requester email', () => {
    const input = validInput();
    input.requester.email = 'not-an-email';

    const result = createRequestSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it('requires exactly three approvers', () => {
    const input = validInput();
    input.approvers = input.approvers.slice(0, 2);

    const result = createRequestSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it('rejects duplicated approver roles regardless of casing', () => {
    const input = validInput();
    input.approvers[1].role = 'manager';

    const result = createRequestSchema.safeParse(input);

    expect(result.success).toBe(false);
    expect(result.error?.issues.at(0)?.message).toBe(
      'The three approver roles must be different',
    );
  });

  it('rejects duplicated approver emails regardless of casing', () => {
    const input = validInput();
    input.approvers[2].email = 'ONE@example.com';

    const result = createRequestSchema.safeParse(input);

    expect(result.success).toBe(false);
    expect(result.error?.issues.at(0)?.message).toBe(
      'The three approvers must have different email addresses',
    );
  });
});
