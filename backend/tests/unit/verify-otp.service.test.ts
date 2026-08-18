import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ApproverItem,
  PurchaseRequestItem,
} from '../../src/domain/purchase-request';
import type { PurchaseRequestRepository } from '../../src/repositories/purchase-request.repository';
import { VerifyOtpService } from '../../src/services/verify-otp.service';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../../src/shared/errors';
import { OTP_MAX_ATTEMPTS, hashOtp } from '../../src/shared/otp';

const requestId = 'req-1';
const approverId = 'approver-1';
const approvalToken = 'a3b1f4c2-1111-4222-8333-444455556666';
const otp = '123456';
const now = new Date('2026-08-17T10:00:00.000Z');

const approver = (overrides: Partial<ApproverItem> = {}): ApproverItem => ({
  PK: `REQUEST#${requestId}`,
  SK: 'APPROVER#01#approver-1',
  entityType: 'APPROVER',
  requestId,
  approverId,
  order: 1,
  role: 'Manager',
  name: 'Approver One',
  email: 'one@example.com',
  status: 'PENDING',
  approvalToken,
  otpHash: hashOtp(approverId, otp),
  otpExpiresAt: '2026-08-17T10:03:00.000Z',
  otpAttempts: 0,
  createdAt: '2026-08-17T09:00:00.000Z',
  updatedAt: '2026-08-17T09:00:00.000Z',
  GSI2PK: `APPROVAL_TOKEN#${approvalToken}`,
  GSI2SK: `REQUEST#${requestId}#APPROVER#${approverId}`,
  ...overrides,
});

const request = (
  overrides: Partial<PurchaseRequestItem> = {},
): PurchaseRequestItem => ({
  PK: `REQUEST#${requestId}`,
  SK: 'METADATA',
  entityType: 'PURCHASE_REQUEST',
  requestId,
  title: 'Compra de portátiles',
  description: 'Tres equipos',
  amount: 15000000,
  requester: { id: 'user-001', name: 'Demo', email: 'demo@example.com' },
  status: 'PENDING',
  currentApproverOrder: 1,
  createdAt: '2026-08-17T09:00:00.000Z',
  updatedAt: '2026-08-17T09:00:00.000Z',
  GSI1PK: 'REQUESTER#user-001',
  GSI1SK: 'CREATED_AT#2026-08-17T09:00:00.000Z#REQUEST#req-1',
  ...overrides,
});

describe('VerifyOtpService', () => {
  let repository: {
    findApproverByToken: ReturnType<typeof vi.fn>;
    findRequestMetadata: ReturnType<typeof vi.fn>;
    incrementOtpAttempts: ReturnType<typeof vi.fn>;
    markOtpVerified: ReturnType<typeof vi.fn>;
  };
  let service: VerifyOtpService;

  beforeEach(() => {
    repository = {
      findApproverByToken: vi.fn().mockResolvedValue(approver()),
      findRequestMetadata: vi.fn().mockResolvedValue(request()),
      incrementOtpAttempts: vi.fn().mockResolvedValue(1),
      markOtpVerified: vi.fn().mockResolvedValue(undefined),
    };
    service = new VerifyOtpService(
      repository as unknown as PurchaseRequestRepository,
    );
  });

  it('returns the purchase detail when the code is correct', async () => {
    const purchase = await service.execute(approvalToken, otp, now);

    expect(purchase.title).toBe('Compra de portátiles');
    expect(purchase.amount).toBe(15000000);
    expect(purchase.requester.name).toBe('Demo');
    expect(purchase.approver).toEqual({
      name: 'Approver One',
      role: 'Manager',
      order: 1,
    });
  });

  it('marks the approval as verified', async () => {
    await service.execute(approvalToken, otp, now);

    expect(repository.markOtpVerified).toHaveBeenCalledWith(
      requestId,
      'APPROVER#01#approver-1',
      now.toISOString(),
    );
  });

  it('never returns internal fields with the purchase detail', async () => {
    const purchase = await service.execute(approvalToken, otp, now);

    expect(JSON.stringify(purchase)).not.toContain('otpHash');
    expect(JSON.stringify(purchase)).not.toContain(approvalToken);
    expect(purchase).not.toHaveProperty('PK');
  });

  it('rejects a wrong code and reports the remaining attempts', async () => {
    repository.incrementOtpAttempts.mockResolvedValue(2);

    await expect(
      service.execute(approvalToken, '999999', now),
    ).rejects.toMatchObject({
      name: 'UnauthorizedError',
      details: { attemptsLeft: OTP_MAX_ATTEMPTS - 2 },
    });
    expect(repository.markOtpVerified).not.toHaveBeenCalled();
  });

  it('counts every failed attempt', async () => {
    await expect(
      service.execute(approvalToken, '999999', now),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    expect(repository.incrementOtpAttempts).toHaveBeenCalledTimes(1);
  });

  it('rejects an expired code', async () => {
    const late = new Date('2026-08-17T10:03:01.000Z');

    await expect(
      service.execute(approvalToken, otp, late),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(repository.markOtpVerified).not.toHaveBeenCalled();
  });

  it('accepts the code one second before it expires', async () => {
    const almost = new Date('2026-08-17T10:02:59.000Z');

    await expect(
      service.execute(approvalToken, otp, almost),
    ).resolves.toBeDefined();
  });

  it('blocks after too many attempts', async () => {
    repository.findApproverByToken.mockResolvedValue(
      approver({ otpAttempts: OTP_MAX_ATTEMPTS }),
    );

    await expect(service.execute(approvalToken, otp, now)).rejects.toThrow(
      'Too many OTP attempts, request a new code',
    );
    expect(repository.incrementOtpAttempts).not.toHaveBeenCalled();
  });

  it('fails when no code was requested', async () => {
    repository.findApproverByToken.mockResolvedValue(
      approver({ otpHash: undefined, otpExpiresAt: undefined }),
    );

    await expect(service.execute(approvalToken, otp, now)).rejects.toThrow(
      'No OTP has been requested for this approval',
    );
  });

  it('fails when it is not this approver turn', async () => {
    repository.findRequestMetadata.mockResolvedValue(
      request({ currentApproverOrder: 2 }),
    );

    await expect(
      service.execute(approvalToken, otp, now),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('fails when the token does not exist', async () => {
    repository.findApproverByToken.mockResolvedValue(undefined);

    await expect(
      service.execute(approvalToken, otp, now),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
