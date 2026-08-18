import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findByRequester } = vi.hoisted(() => ({
  findByRequester: vi.fn(),
}));

vi.mock('../../src/repositories/purchase-request.repository', () => ({
  PurchaseRequestRepository: class {
    findByRequester = findByRequester;
  },
}));

import { handler } from '../../src/handlers/list-requests';

interface ResponseBody {
  requests: Record<string, unknown>[];
  message?: string;
}

const invoke = async (requesterId?: string) => {
  const result = await handler(
    {
      queryStringParameters: requesterId === undefined ? null : { requesterId },
    } as unknown as APIGatewayProxyEvent,
    {} as Context,
    () => undefined,
  );

  return result as APIGatewayProxyResult;
};

const parse = (body: string) => JSON.parse(body) as ResponseBody;

describe('list-requests handler', () => {
  beforeEach(() => {
    findByRequester.mockReset();
    findByRequester.mockResolvedValue([]);
  });

  it('returns the requester requests', async () => {
    findByRequester.mockResolvedValue([
      {
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
      },
    ]);

    const response = await invoke('user-001');
    const body = parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(findByRequester).toHaveBeenCalledWith('user-001');
    expect(body.requests).toHaveLength(1);
    expect(body.requests[0]).not.toHaveProperty('PK');
  });

  it('returns an empty list when there are no requests', async () => {
    const response = await invoke('user-002');

    expect(response.statusCode).toBe(200);
    expect(parse(response.body).requests).toEqual([]);
  });

  it('returns 400 when requesterId is missing', async () => {
    const response = await invoke();

    expect(response.statusCode).toBe(400);
    expect(parse(response.body).message).toBe('Validation failed');
    expect(findByRequester).not.toHaveBeenCalled();
  });

  it('returns 400 when requesterId is blank', async () => {
    const response = await invoke('   ');

    expect(response.statusCode).toBe(400);
    expect(findByRequester).not.toHaveBeenCalled();
  });

  it('returns 500 without leaking repository errors', async () => {
    findByRequester.mockRejectedValue(new Error('dynamo is down'));
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const response = await invoke('user-001');

    expect(response.statusCode).toBe(500);
    expect(parse(response.body).message).toBe('Internal server error');
    expect(response.body).not.toContain('dynamo is down');
    consoleError.mockRestore();
  });
});
