import { describe, expect, it } from 'vitest';
import { approvalTokenParamsSchema } from '../../src/schemas/approval-token.schema';
import { decisionBodySchema } from '../../src/schemas/decision.schema';
import { listMockMailsQuerySchema } from '../../src/schemas/list-mock-mails.schema';
import { listRequestsQuerySchema } from '../../src/schemas/list-requests.schema';
import { verifyOtpBodySchema } from '../../src/schemas/verify-otp.schema';

describe('approvalTokenParamsSchema', () => {
  it('accepts a uuid', () => {
    const result = approvalTokenParamsSchema.safeParse({
      approvalToken: 'a3b1f4c2-1111-4222-8333-444455556666',
    });

    expect(result.success).toBe(true);
  });

  it.each([
    ['not a uuid', 'abc'],
    ['empty', ''],
    ['sql-ish payload', "' OR 1=1 --"],
  ])('rejects %s', (_label, approvalToken) => {
    expect(approvalTokenParamsSchema.safeParse({ approvalToken }).success).toBe(
      false,
    );
  });

  it('rejects a missing token', () => {
    expect(approvalTokenParamsSchema.safeParse({}).success).toBe(false);
  });
});

describe('verifyOtpBodySchema', () => {
  it('accepts exactly six digits', () => {
    expect(verifyOtpBodySchema.safeParse({ otp: '012345' }).success).toBe(true);
  });

  it.each([
    ['five digits', '12345'],
    ['seven digits', '1234567'],
    ['letters', 'abcdef'],
    ['mixed', '12a456'],
    ['empty', ''],
  ])('rejects %s', (_label, otp) => {
    expect(verifyOtpBodySchema.safeParse({ otp }).success).toBe(false);
  });

  it('rejects a missing code', () => {
    expect(verifyOtpBodySchema.safeParse({}).success).toBe(false);
  });
});

describe('decisionBodySchema', () => {
  it.each(['APPROVE', 'REJECT'])('accepts %s', (decision) => {
    expect(decisionBodySchema.safeParse({ decision }).success).toBe(true);
  });

  it.each(['MAYBE', 'approve', '', 'SIGNED'])('rejects %s', (decision) => {
    expect(decisionBodySchema.safeParse({ decision }).success).toBe(false);
  });
});

describe('listMockMailsQuerySchema', () => {
  it('defaults the limit when absent', () => {
    const result = listMockMailsQuerySchema.parse({});

    expect(result.limit).toBe(50);
    expect(result.requestId).toBeUndefined();
  });

  it('coerces the limit from the query string', () => {
    expect(listMockMailsQuerySchema.parse({ limit: '10' }).limit).toBe(10);
  });

  it.each(['0', '101', '-1', 'abc', '1.5'])(
    'rejects an out of range limit %s',
    (limit) => {
      expect(listMockMailsQuerySchema.safeParse({ limit }).success).toBe(false);
    },
  );
});

describe('listRequestsQuerySchema', () => {
  it('requires a requester id', () => {
    expect(listRequestsQuerySchema.safeParse({}).success).toBe(false);
    expect(
      listRequestsQuerySchema.safeParse({ requesterId: '  ' }).success,
    ).toBe(false);
  });

  it('trims the requester id', () => {
    expect(
      listRequestsQuerySchema.parse({ requesterId: ' user-001 ' }).requesterId,
    ).toBe('user-001');
  });
});
