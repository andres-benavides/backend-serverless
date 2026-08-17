import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApproverItem } from '../../src/domain/purchase-request';
import type { PurchaseRequestRepository } from '../../src/repositories/purchase-request.repository';
import { SubmitDecisionService } from '../../src/services/submit-decision.service';
import { ConflictError, NotFoundError } from '../../src/shared/errors';

const requestId = 'req-1';
const approvalToken = 'a3b1f4c2-1111-4222-8333-444455556666';
const now = new Date('2026-08-17T10:00:00.000Z');

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
  taskToken: 'task-token-1',
  otpVerifiedAt: '2026-08-17T09:59:00.000Z',
  createdAt: '2026-08-17T09:00:00.000Z',
  updatedAt: '2026-08-17T09:00:00.000Z',
  GSI2PK: `APPROVAL_TOKEN#${approvalToken}`,
  GSI2SK: `REQUEST#${requestId}#APPROVER#approver-1`,
  ...overrides,
});

describe('SubmitDecisionService', () => {
  let repository: {
    findApproverByToken: ReturnType<typeof vi.fn>;
    recordDecision: ReturnType<typeof vi.fn>;
    markCallbackSent: ReturnType<typeof vi.fn>;
  };
  let reportDecision: ReturnType<typeof vi.fn>;
  let service: SubmitDecisionService;

  beforeEach(() => {
    repository = {
      findApproverByToken: vi.fn().mockResolvedValue(approver()),
      recordDecision: vi
        .fn()
        .mockImplementation((_id, _sk, status: string, decidedAt: string) =>
          Promise.resolve(
            approver(
              status === 'SIGNED'
                ? { status: 'SIGNED', signedAt: decidedAt }
                : { status: 'REJECTED', rejectedAt: decidedAt },
            ),
          ),
        ),
      markCallbackSent: vi.fn().mockResolvedValue(undefined),
    };
    reportDecision = vi.fn().mockResolvedValue('DELIVERED');
    service = new SubmitDecisionService(
      repository as unknown as PurchaseRequestRepository,
      { reportDecision },
    );
  });

  it('signs the approval and resumes the workflow', async () => {
    const result = await service.execute(approvalToken, 'APPROVE', now);

    expect(result.status).toBe('SIGNED');
    expect(repository.recordDecision).toHaveBeenCalledWith(
      requestId,
      'APPROVER#01#approver-1',
      'SIGNED',
      now.toISOString(),
    );
    expect(reportDecision).toHaveBeenCalledWith('task-token-1', 'APPROVED');
  });

  it('rejects the approval and reports it to the workflow', async () => {
    const result = await service.execute(approvalToken, 'REJECT', now);

    expect(result.status).toBe('REJECTED');
    expect(reportDecision).toHaveBeenCalledWith('task-token-1', 'REJECTED');
  });

  it('writes to dynamodb before notifying step functions', async () => {
    const order: string[] = [];
    repository.recordDecision.mockImplementation(() => {
      order.push('dynamodb');
      return Promise.resolve(
        approver({ status: 'SIGNED', signedAt: now.toISOString() }),
      );
    });
    reportDecision.mockImplementation(() => {
      order.push('callback');
      return Promise.resolve('DELIVERED');
    });

    await service.execute(approvalToken, 'APPROVE', now);

    expect(order).toEqual(['dynamodb', 'callback']);
  });

  it('marks the callback as sent so a retry does not repeat it', async () => {
    await service.execute(approvalToken, 'APPROVE', now);

    expect(repository.markCallbackSent).toHaveBeenCalledWith(
      requestId,
      'APPROVER#01#approver-1',
      now.toISOString(),
    );
  });

  it('refuses to decide before the otp is verified', async () => {
    repository.findApproverByToken.mockResolvedValue(
      approver({ otpVerifiedAt: undefined }),
    );

    await expect(
      service.execute(approvalToken, 'APPROVE', now),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(repository.recordDecision).not.toHaveBeenCalled();
    expect(reportDecision).not.toHaveBeenCalled();
  });

  it('fails when the token does not exist', async () => {
    repository.findApproverByToken.mockResolvedValue(undefined);

    await expect(
      service.execute(approvalToken, 'APPROVE', now),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects a second decision once the callback was delivered', async () => {
    repository.findApproverByToken.mockResolvedValue(
      approver({
        status: 'SIGNED',
        signedAt: '2026-08-17T09:59:30.000Z',
        callbackSentAt: '2026-08-17T09:59:31.000Z',
      }),
    );

    await expect(
      service.execute(approvalToken, 'APPROVE', now),
    ).rejects.toThrow('This approval has already been processed');
    expect(reportDecision).not.toHaveBeenCalled();
  });

  it('rejects flipping an already signed approval to rejected', async () => {
    repository.findApproverByToken.mockResolvedValue(
      approver({ status: 'SIGNED', callbackSentAt: '2026-08-17T09:59:31Z' }),
    );

    await expect(
      service.execute(approvalToken, 'REJECT', now),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('resends the callback when the previous attempt died after writing', async () => {
    repository.findApproverByToken.mockResolvedValue(
      approver({
        status: 'SIGNED',
        signedAt: '2026-08-17T09:59:30.000Z',
        callbackSentAt: undefined,
      }),
    );

    const result = await service.execute(approvalToken, 'APPROVE', now);

    expect(repository.recordDecision).not.toHaveBeenCalled();
    expect(reportDecision).toHaveBeenCalledWith('task-token-1', 'APPROVED');
    expect(result.decidedAt).toBe('2026-08-17T09:59:30.000Z');
  });

  it('surfaces a conditional write failure as a conflict', async () => {
    const conditional = new Error('The conditional request failed');
    conditional.name = 'ConditionalCheckFailedException';
    repository.recordDecision.mockRejectedValue(conditional);

    await expect(
      service.execute(approvalToken, 'APPROVE', now),
    ).rejects.toThrow('The conditional request failed');
    expect(reportDecision).not.toHaveBeenCalled();
  });

  it('does not mark the callback as sent when step functions fails', async () => {
    reportDecision.mockRejectedValue(new Error('states unavailable'));

    await expect(
      service.execute(approvalToken, 'APPROVE', now),
    ).rejects.toThrow('states unavailable');
    expect(repository.markCallbackSent).not.toHaveBeenCalled();
  });

  it('fails when the approver has no workflow task attached', async () => {
    repository.recordDecision.mockResolvedValue(
      approver({ status: 'SIGNED', taskToken: undefined }),
    );

    await expect(
      service.execute(approvalToken, 'APPROVE', now),
    ).rejects.toThrow('This approval has no pending workflow task');
  });
});
