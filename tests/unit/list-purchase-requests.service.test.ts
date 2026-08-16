import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PurchaseRequestItem } from '../../src/domain/purchase-request';
import type { PurchaseRequestRepository } from '../../src/repositories/purchase-request.repository';
import { ListPurchaseRequestsService } from '../../src/services/list-purchase-requests.service';

const storedRequest: PurchaseRequestItem = {
  PK: 'REQUEST#request-1',
  SK: 'METADATA',
  entityType: 'PURCHASE_REQUEST',
  requestId: 'request-1',
  title: 'Compra de portatiles',
  description: 'Tres equipos',
  amount: 15000000,
  requester: { id: 'user-001', name: 'Demo', email: 'demo@example.com' },
  status: 'PENDING',
  currentApproverOrder: 1,
  createdAt: '2026-08-16T20:00:00.000Z',
  updatedAt: '2026-08-16T20:00:00.000Z',
  GSI1PK: 'REQUESTER#user-001',
  GSI1SK: 'CREATED_AT#2026-08-16T20:00:00.000Z#REQUEST#request-1',
};

describe('ListPurchaseRequestsService', () => {
  let findByRequester: ReturnType<typeof vi.fn>;
  let service: ListPurchaseRequestsService;

  beforeEach(() => {
    findByRequester = vi.fn().mockResolvedValue([storedRequest]);
    service = new ListPurchaseRequestsService({
      findByRequester,
    } as unknown as PurchaseRequestRepository);
  });

  it('queries requests using the requester id', async () => {
    await service.execute('user-001');

    expect(findByRequester).toHaveBeenCalledWith('user-001');
  });

  it('returns request summaries without DynamoDB implementation fields', async () => {
    const requests = await service.execute('user-001');

    expect(requests).toEqual([
      expect.objectContaining({ requestId: 'request-1', status: 'PENDING' }),
    ]);
    expect(requests[0]).not.toHaveProperty('PK');
    expect(requests[0]).not.toHaveProperty('SK');
    expect(requests[0]).not.toHaveProperty('GSI1PK');
    expect(requests[0]).not.toHaveProperty('GSI1SK');
    expect(requests[0]).not.toHaveProperty('entityType');
  });

  it('returns an empty list when the requester has no requests', async () => {
    findByRequester.mockResolvedValue([]);

    await expect(service.execute('user-002')).resolves.toEqual([]);
  });
});
