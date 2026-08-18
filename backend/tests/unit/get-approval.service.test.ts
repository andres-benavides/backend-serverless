import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ApproverItem,
  PurchaseRequestItem,
} from '../../src/domain/purchase-request';
import type { PurchaseRequestRepository } from '../../src/repositories/purchase-request.repository';
import { GetApprovalService } from '../../src/services/get-approval.service';
import { NotFoundError } from '../../src/shared/errors';

const requestId = 'req-1';
const approvalToken = 'a3b1f4c2-1111-4222-8333-444455556666';

const approver = (overrides: Partial<ApproverItem> = {}): ApproverItem => ({
  PK: `REQUEST#${requestId}`,
  SK: 'APPROVER#01#approver-1',
  entityType: 'APPROVER',
  requestId,
  approverId: 'approver-1',
  order: 1,
  role: 'Manager',
  name: 'Approver One',
  email: 'one@example.com',
  status: 'PENDING',
  approvalToken,
  createdAt: '2026-08-16T20:00:00.000Z',
  updatedAt: '2026-08-16T20:00:00.000Z',
  GSI2PK: `APPROVAL_TOKEN#${approvalToken}`,
  GSI2SK: `REQUEST#${requestId}#APPROVER#approver-1`,
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
  createdAt: '2026-08-16T20:00:00.000Z',
  updatedAt: '2026-08-16T20:00:00.000Z',
  GSI1PK: 'REQUESTER#user-001',
  GSI1SK: 'CREATED_AT#2026-08-16T20:00:00.000Z#REQUEST#req-1',
  ...overrides,
});

describe('GetApprovalService', () => {
  let repository: {
    findApproverByToken: ReturnType<typeof vi.fn>;
    findRequestMetadata: ReturnType<typeof vi.fn>;
  };
  let service: GetApprovalService;

  beforeEach(() => {
    repository = {
      findApproverByToken: vi.fn(),
      findRequestMetadata: vi.fn(),
    };
    service = new GetApprovalService(
      repository as unknown as PurchaseRequestRepository,
    );
  });

  it('marks the approval as active when it is this approver turn', async () => {
    repository.findApproverByToken.mockResolvedValue(approver());
    repository.findRequestMetadata.mockResolvedValue(request());

    const result = await service.execute(approvalToken);

    expect(result).toEqual({
      status: 'PENDING',
      active: true,
      requiresOtp: true,
    });
  });

  it('looks the approver up by its public token', async () => {
    repository.findApproverByToken.mockResolvedValue(approver());
    repository.findRequestMetadata.mockResolvedValue(request());

    await service.execute(approvalToken);

    expect(repository.findApproverByToken).toHaveBeenCalledWith(approvalToken);
    expect(repository.findRequestMetadata).toHaveBeenCalledWith(requestId);
  });

  it('is not active when it is not this approver turn yet', async () => {
    repository.findApproverByToken.mockResolvedValue(approver({ order: 2 }));
    repository.findRequestMetadata.mockResolvedValue(
      request({ currentApproverOrder: 1 }),
    );

    const result = await service.execute(approvalToken);

    expect(result.active).toBe(false);
    expect(result.requiresOtp).toBe(false);
  });

  it('is not active when the approval was already signed', async () => {
    repository.findApproverByToken.mockResolvedValue(
      approver({ status: 'SIGNED' }),
    );
    repository.findRequestMetadata.mockResolvedValue(request());

    const result = await service.execute(approvalToken);

    expect(result.status).toBe('SIGNED');
    expect(result.active).toBe(false);
  });

  it('is not active when the request was rejected', async () => {
    repository.findApproverByToken.mockResolvedValue(approver());
    repository.findRequestMetadata.mockResolvedValue(
      request({ status: 'REJECTED' }),
    );

    const result = await service.execute(approvalToken);

    expect(result.active).toBe(false);
  });

  it('is not active when the request was already completed', async () => {
    repository.findApproverByToken.mockResolvedValue(approver());
    repository.findRequestMetadata.mockResolvedValue(
      request({ status: 'COMPLETED' }),
    );

    const result = await service.execute(approvalToken);

    expect(result.active).toBe(false);
  });

  it('fails when the token does not match any approver', async () => {
    repository.findApproverByToken.mockResolvedValue(undefined);

    await expect(service.execute(approvalToken)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(repository.findRequestMetadata).not.toHaveBeenCalled();
  });

  it('fails when the parent request is missing', async () => {
    repository.findApproverByToken.mockResolvedValue(approver());
    repository.findRequestMetadata.mockResolvedValue(undefined);

    await expect(service.execute(approvalToken)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('propagates repository failures', async () => {
    repository.findApproverByToken.mockRejectedValue(new Error('dynamo down'));

    await expect(service.execute(approvalToken)).rejects.toThrow('dynamo down');
  });

  it('never returns internal fields', async () => {
    repository.findApproverByToken.mockResolvedValue(approver());
    repository.findRequestMetadata.mockResolvedValue(request());

    const result = await service.execute(approvalToken);

    expect(Object.keys(result).sort()).toEqual([
      'active',
      'requiresOtp',
      'status',
    ]);
  });
});
