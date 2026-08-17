import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApproverItem } from '../../src/domain/purchase-request';
import type { PurchaseRequestRepository } from '../../src/repositories/purchase-request.repository';
import { ActivateApproverService } from '../../src/services/activate-approver.service';
import { NotFoundError } from '../../src/shared/errors';

const requestId = 'req-1';

const approver: ApproverItem = {
  PK: `REQUEST#${requestId}`,
  SK: 'APPROVER#02#approver-2',
  entityType: 'APPROVER',
  requestId,
  approverId: 'approver-2',
  order: 2,
  role: 'Finance',
  name: 'Approver Two',
  email: 'two@example.com',
  status: 'PENDING',
  approvalToken: 'token-2',
  createdAt: '2026-08-16T20:00:00.000Z',
  updatedAt: '2026-08-16T20:00:00.000Z',
  GSI2PK: 'APPROVAL_TOKEN#token-2',
  GSI2SK: `REQUEST#${requestId}#APPROVER#approver-2`,
};

describe('ActivateApproverService', () => {
  let repository: {
    findApproverByOrder: ReturnType<typeof vi.fn>;
    activateApprover: ReturnType<typeof vi.fn>;
  };
  let service: ActivateApproverService;

  beforeEach(() => {
    repository = {
      findApproverByOrder: vi.fn().mockResolvedValue(approver),
      activateApprover: vi.fn().mockResolvedValue(undefined),
    };
    service = new ActivateApproverService(
      repository as unknown as PurchaseRequestRepository,
    );
  });

  it('stores the task token against the approver of that order', async () => {
    await service.execute({ requestId, order: 2, taskToken: 'task-token-abc' });

    expect(repository.findApproverByOrder).toHaveBeenCalledWith(requestId, 2);
    expect(repository.activateApprover).toHaveBeenCalledWith(
      requestId,
      'APPROVER#02#approver-2',
      2,
      'task-token-abc',
    );
  });

  it('fails when the approver does not exist', async () => {
    repository.findApproverByOrder.mockResolvedValue(undefined);

    await expect(
      service.execute({ requestId, order: 2, taskToken: 'task-token-abc' }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repository.activateApprover).not.toHaveBeenCalled();
  });

  it('propagates conditional write failures', async () => {
    repository.activateApprover.mockRejectedValue(
      new Error('ConditionalCheckFailed'),
    );

    await expect(
      service.execute({ requestId, order: 2, taskToken: 'task-token-abc' }),
    ).rejects.toThrow('ConditionalCheckFailed');
  });
});
