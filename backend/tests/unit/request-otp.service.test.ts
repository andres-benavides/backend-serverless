import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ApproverItem,
  PurchaseRequestItem,
} from '../../src/domain/purchase-request';
import type { PurchaseRequestRepository } from '../../src/repositories/purchase-request.repository';
import { RequestOtpService } from '../../src/services/request-otp.service';
import { ConflictError } from '../../src/shared/errors';
import { hashOtp } from '../../src/shared/otp';

const requestId = 'req-1';
const approverId = 'approver-1';
const approvalToken = 'a3b1f4c2-1111-4222-8333-444455556666';

const approver: ApproverItem = {
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
  createdAt: '2026-08-17T09:00:00.000Z',
  updatedAt: '2026-08-17T09:00:00.000Z',
  GSI2PK: `APPROVAL_TOKEN#${approvalToken}`,
  GSI2SK: `REQUEST#${requestId}#APPROVER#${approverId}`,
};

const request: PurchaseRequestItem = {
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
};

describe('RequestOtpService', () => {
  let repository: {
    findApproverByToken: ReturnType<typeof vi.fn>;
    findRequestMetadata: ReturnType<typeof vi.fn>;
    saveOtp: ReturnType<typeof vi.fn>;
  };
  let sendOtpMail: ReturnType<typeof vi.fn>;
  let service: RequestOtpService;

  const sentMail = (index: number) =>
    sendOtpMail.mock.calls[index][0] as { otp: string };

  beforeEach(() => {
    repository = {
      findApproverByToken: vi.fn().mockResolvedValue(approver),
      findRequestMetadata: vi.fn().mockResolvedValue(request),
      saveOtp: vi.fn().mockResolvedValue(undefined),
    };
    sendOtpMail = vi.fn().mockResolvedValue(undefined);
    service = new RequestOtpService(
      repository as unknown as PurchaseRequestRepository,
      { sendOtpMail },
    );
  });

  it('stores only the hash, never the code itself', async () => {
    await service.execute(approvalToken);

    const storedHash = (repository.saveOtp.mock.calls[0] as string[])[2];
    const sentOtp = sentMail(0).otp;

    expect(storedHash).not.toBe(sentOtp);
    expect(storedHash).toBe(hashOtp(approverId, sentOtp));
  });

  it('returns the expiry without leaking the code', async () => {
    const result = await service.execute(approvalToken);

    expect(Object.keys(result)).toEqual(['expiresAt']);
    expect(typeof result.expiresAt).toBe('string');
    expect(JSON.stringify(result)).not.toContain(sentMail(0).otp);
  });

  it('sets the expiry three minutes ahead', async () => {
    const before = Date.now();

    const { expiresAt } = await service.execute(approvalToken);

    const delta = new Date(expiresAt).getTime() - before;
    expect(delta).toBeGreaterThan(178_000);
    expect(delta).toBeLessThanOrEqual(181_000);
  });

  it('delivers the code through the mail channel', async () => {
    await service.execute(approvalToken);

    const mail = sendOtpMail.mock.calls[0][0] as {
      to: string;
      approverId: string;
      requestId: string;
      otp: string;
    };

    expect(mail.to).toBe('one@example.com');
    expect(mail.approverId).toBe(approverId);
    expect(mail.requestId).toBe(requestId);
    expect(mail.otp).toMatch(/^\d{6}$/);
  });

  it('refuses to issue a code when it is not this approver turn', async () => {
    repository.findRequestMetadata.mockResolvedValue({
      ...request,
      currentApproverOrder: 2,
    });

    await expect(service.execute(approvalToken)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(repository.saveOtp).not.toHaveBeenCalled();
    expect(sendOtpMail).not.toHaveBeenCalled();
  });

  it('refuses to issue a code for a closed request', async () => {
    repository.findRequestMetadata.mockResolvedValue({
      ...request,
      status: 'REJECTED',
    });

    await expect(service.execute(approvalToken)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('issues a different code on each call', async () => {
    await service.execute(approvalToken);
    await service.execute(approvalToken);

    const first = sentMail(0).otp;
    const second = sentMail(1).otp;

    expect(repository.saveOtp).toHaveBeenCalledTimes(2);
    expect(first).not.toBe(second);
  });
});
