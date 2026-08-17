import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateRequestStatus } = vi.hoisted(() => ({
  updateRequestStatus: vi.fn(),
}));

vi.mock('../../src/repositories/purchase-request.repository', () => ({
  PurchaseRequestRepository: class {
    updateRequestStatus = updateRequestStatus;
  },
}));

import { handler } from '../../src/handlers/finalize-request';

describe('finalize-request handler', () => {
  beforeEach(() => {
    updateRequestStatus.mockReset();
    updateRequestStatus.mockResolvedValue(undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('completes the request', async () => {
    const result = await handler({ requestId: 'req-1', status: 'COMPLETED' });

    expect(updateRequestStatus).toHaveBeenCalledWith('req-1', 'COMPLETED');
    expect(result).toEqual({ status: 'COMPLETED' });
  });

  it('rejects the request', async () => {
    const result = await handler({ requestId: 'req-1', status: 'REJECTED' });

    expect(updateRequestStatus).toHaveBeenCalledWith('req-1', 'REJECTED');
    expect(result).toEqual({ status: 'REJECTED' });
  });

  it('propagates conditional write failures so the state fails loudly', async () => {
    updateRequestStatus.mockRejectedValue(new Error('ConditionalCheckFailed'));

    await expect(
      handler({ requestId: 'req-1', status: 'COMPLETED' }),
    ).rejects.toThrow('ConditionalCheckFailed');
  });
});
