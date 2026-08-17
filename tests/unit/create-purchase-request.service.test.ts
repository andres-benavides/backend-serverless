import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreatePurchaseRequestInput } from '../../src/domain/purchase-request';
import type { PurchaseRequestRepository } from '../../src/repositories/purchase-request.repository';
import { CreatePurchaseRequestService } from '../../src/services/create-purchase-request.service';

const input: CreatePurchaseRequestInput = {
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
};

describe('CreatePurchaseRequestService', () => {
  let repository: {
    create: ReturnType<typeof vi.fn>;
    saveExecutionArn: ReturnType<typeof vi.fn>;
  };
  let service: CreatePurchaseRequestService;

  beforeEach(() => {
    repository = {
      create: vi.fn().mockResolvedValue(undefined),
      saveExecutionArn: vi.fn().mockResolvedValue(undefined),
    };
    service = new CreatePurchaseRequestService(
      repository as unknown as PurchaseRequestRepository,
    );
  });

  it('creates the request in PENDING state', async () => {
    const { request } = await service.execute(input);

    expect(request.status).toBe('PENDING');
    expect(request.currentApproverOrder).toBe(1);
    expect(request.entityType).toBe('PURCHASE_REQUEST');
    expect(request.title).toBe(input.title);
    expect(request.amount).toBe(input.amount);
  });

  it('builds the single table keys for the request', async () => {
    const { request } = await service.execute(input);

    expect(request.PK).toBe(`REQUEST#${request.requestId}`);
    expect(request.SK).toBe('METADATA');
    expect(request.GSI1PK).toBe(`REQUESTER#${input.requester.id}`);
    expect(request.GSI1SK).toContain(`REQUEST#${request.requestId}`);
  });

  it('creates one approver per input preserving the order', async () => {
    const { approvers } = await service.execute(input);

    expect(approvers).toHaveLength(3);
    expect(approvers.map((approver) => approver.order)).toEqual([1, 2, 3]);
    expect(approvers.map((approver) => approver.role)).toEqual([
      'Manager',
      'Finance',
      'Director',
    ]);
    expect(approvers.every((approver) => approver.status === 'PENDING')).toBe(
      true,
    );
  });

  it('pads the approver sort key so ordering stays lexicographic', async () => {
    const { approvers, request } = await service.execute(input);

    expect(approvers[0].SK).toBe(`APPROVER#01#${approvers[0].approverId}`);
    expect(approvers[0].PK).toBe(`REQUEST#${request.requestId}`);
  });

  it('generates a unique approval token per approver', async () => {
    const { approvers } = await service.execute(input);

    const tokens = approvers.map((approver) => approver.approvalToken);

    expect(new Set(tokens).size).toBe(3);
    approvers.forEach((approver) => {
      expect(approver.GSI2PK).toBe(`APPROVAL_TOKEN#${approver.approvalToken}`);
    });
  });

  it('persists the request and its approvers in a single call', async () => {
    const { request, approvers } = await service.execute(input);

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.create).toHaveBeenCalledWith(request, approvers);
  });

  it('propagates repository failures', async () => {
    repository.create.mockRejectedValue(new Error('dynamo is down'));

    await expect(service.execute(input)).rejects.toThrow('dynamo is down');
  });

  it('does not touch the workflow when none is configured', async () => {
    await service.execute(input);

    expect(repository.saveExecutionArn).not.toHaveBeenCalled();
  });

  it('starts the approval workflow and stores its execution arn', async () => {
    const executionArn = 'arn:aws:states:us-east-1:1:execution:flow:req-1';
    const workflow = { start: vi.fn().mockResolvedValue(executionArn) };
    service = new CreatePurchaseRequestService(
      repository as unknown as PurchaseRequestRepository,
      workflow,
    );

    const { request } = await service.execute(input);

    expect(workflow.start).toHaveBeenCalledWith(request.requestId);
    expect(repository.saveExecutionArn).toHaveBeenCalledWith(
      request.requestId,
      executionArn,
    );
    expect(request.executionArn).toBe(executionArn);
  });

  it('starts the workflow only after the request is persisted', async () => {
    const order: string[] = [];
    repository.create.mockImplementation(async () => {
      order.push('create');
      return Promise.resolve();
    });
    const workflow = {
      start: vi.fn().mockImplementation(async () => {
        order.push('start');
        return Promise.resolve('arn');
      }),
    };
    service = new CreatePurchaseRequestService(
      repository as unknown as PurchaseRequestRepository,
      workflow,
    );

    await service.execute(input);

    expect(order).toEqual(['create', 'start']);
  });

  it('propagates workflow failures', async () => {
    const workflow = {
      start: vi.fn().mockRejectedValue(new Error('states unavailable')),
    };
    service = new CreatePurchaseRequestService(
      repository as unknown as PurchaseRequestRepository,
      workflow,
    );

    await expect(service.execute(input)).rejects.toThrow('states unavailable');
  });
});
