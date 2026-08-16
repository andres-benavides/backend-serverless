import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findById } = vi.hoisted(() => ({ findById: vi.fn() }));

vi.mock('../../src/repositories/purchase-request.repository', () => ({
  PurchaseRequestRepository: class {
    findById = findById;
  },
}));

import { handler } from '../../src/handlers/get-request';

const requestId = 'f48feb64-f93e-4193-932f-5ebaa2d1bea2';

interface ResponseBody {
  request: { requestId: string; status: string };
  approvers: Record<string, unknown>[];
}

interface ErrorBody {
  message: string;
}

const storedItems = () => [
  {
    PK: `REQUEST#${requestId}`,
    SK: 'APPROVER#02#b',
    entityType: 'APPROVER',
    requestId,
    approverId: 'b',
    order: 2,
    role: 'Finance',
    name: 'Approver Two',
    email: 'two@example.com',
    status: 'PENDING',
    approvalToken: 'token-two',
    GSI2PK: 'APPROVAL_TOKEN#token-two',
    GSI2SK: `REQUEST#${requestId}#APPROVER#b`,
    createdAt: '2026-08-16T20:00:00.000Z',
    updatedAt: '2026-08-16T20:00:00.000Z',
  },
  {
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
  },
  {
    PK: `REQUEST#${requestId}`,
    SK: 'APPROVER#01#a',
    entityType: 'APPROVER',
    requestId,
    approverId: 'a',
    order: 1,
    role: 'Manager',
    name: 'Approver One',
    email: 'one@example.com',
    status: 'PENDING',
    approvalToken: 'token-one',
    GSI2PK: 'APPROVAL_TOKEN#token-one',
    GSI2SK: `REQUEST#${requestId}#APPROVER#a`,
    createdAt: '2026-08-16T20:00:00.000Z',
    updatedAt: '2026-08-16T20:00:00.000Z',
  },
];

const invoke = async (id: string | undefined) => {
  const result = await handler(
    {
      pathParameters: id === undefined ? null : { id },
    } as unknown as APIGatewayProxyEvent,
    {} as unknown as Context,
    () => undefined,
  );

  return result as APIGatewayProxyResult;
};

const parse = <T>(body: string) => JSON.parse(body) as T;

describe('get-request handler', () => {
  beforeEach(() => {
    findById.mockReset();
  });

  it('returns 400 when the id is missing', async () => {
    const response = await invoke(undefined);

    expect(response.statusCode).toBe(400);
    expect(parse<ErrorBody>(response.body).message).toBe(
      'Request id is required',
    );
    expect(findById).not.toHaveBeenCalled();
  });

  it('returns 404 when there are no items for the id', async () => {
    findById.mockResolvedValue([]);

    const response = await invoke(requestId);

    expect(response.statusCode).toBe(404);
    expect(parse<ErrorBody>(response.body).message).toBe(
      'Purchase request not found',
    );
  });

  it('returns the request with its approvers sorted by order', async () => {
    findById.mockResolvedValue(storedItems());

    const response = await invoke(requestId);
    const body = parse<ResponseBody>(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.request.requestId).toBe(requestId);
    expect(body.approvers.map((approver) => approver.order)).toEqual([1, 2]);
  });

  it('strips the approval token and its index keys', async () => {
    findById.mockResolvedValue(storedItems());

    const response = await invoke(requestId);
    const body = parse<ResponseBody>(response.body);

    expect(response.body).not.toContain('token-one');
    body.approvers.forEach((approver) => {
      expect(approver).not.toHaveProperty('approvalToken');
      expect(approver).not.toHaveProperty('GSI2PK');
      expect(approver).not.toHaveProperty('GSI2SK');
    });
  });

  it('returns 500 when the repository fails', async () => {
    findById.mockRejectedValue(new Error('dynamo is down'));
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const response = await invoke(requestId);

    expect(response.statusCode).toBe(500);
    expect(parse<ErrorBody>(response.body).message).toBe(
      'Internal server error',
    );

    consoleError.mockRestore();
  });
});
