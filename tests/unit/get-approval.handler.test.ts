import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findApproverByToken, findRequestMetadata } = vi.hoisted(() => ({
  findApproverByToken: vi.fn(),
  findRequestMetadata: vi.fn(),
}));

vi.mock('../../src/repositories/purchase-request.repository', () => ({
  PurchaseRequestRepository: class {
    findApproverByToken = findApproverByToken;
    findRequestMetadata = findRequestMetadata;
  },
}));

import { handler } from '../../src/handlers/get-approval';

const approvalToken = 'a3b1f4c2-1111-4222-8333-444455556666';
const requestId = 'req-1';

interface ApprovalBody {
  approval: { status: string; active: boolean; requiresOtp: boolean };
}

interface ErrorBody {
  message: string;
}

const storedApprover = {
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
};

const storedRequest = {
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
};

const invoke = async (token: string | undefined) => {
  const result = await handler(
    {
      pathParameters: token === undefined ? null : { approvalToken: token },
    } as unknown as APIGatewayProxyEvent,
    {} as unknown as Context,
    () => undefined,
  );

  return result as APIGatewayProxyResult;
};

const parse = <T>(body: string) => JSON.parse(body) as T;

describe('get-approval handler', () => {
  beforeEach(() => {
    findApproverByToken.mockReset();
    findRequestMetadata.mockReset();
  });

  it('returns the minimal approval view for an active approver', async () => {
    findApproverByToken.mockResolvedValue(storedApprover);
    findRequestMetadata.mockResolvedValue(storedRequest);

    const response = await invoke(approvalToken);
    const body = parse<ApprovalBody>(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.approval).toEqual({
      status: 'PENDING',
      active: true,
      requiresOtp: true,
    });
  });

  it('does not leak purchase details or internal keys', async () => {
    findApproverByToken.mockResolvedValue(storedApprover);
    findRequestMetadata.mockResolvedValue(storedRequest);

    const response = await invoke(approvalToken);

    expect(response.body).not.toContain('Compra de portátiles');
    expect(response.body).not.toContain('15000000');
    expect(response.body).not.toContain('approvalToken');
    expect(response.body).not.toContain('GSI2PK');
    expect(response.body).not.toContain('REQUEST#');
    expect(response.body).not.toContain('one@example.com');
  });

  it('returns 400 when the token is missing', async () => {
    const response = await invoke(undefined);

    expect(response.statusCode).toBe(400);
    expect(parse<ErrorBody>(response.body).message).toBe('Validation failed');
    expect(findApproverByToken).not.toHaveBeenCalled();
  });

  it('returns 400 when the token is not a uuid', async () => {
    const response = await invoke('not-a-uuid');

    expect(response.statusCode).toBe(400);
    expect(findApproverByToken).not.toHaveBeenCalled();
  });

  it('returns 404 when the token does not exist', async () => {
    findApproverByToken.mockResolvedValue(undefined);

    const response = await invoke(approvalToken);

    expect(response.statusCode).toBe(404);
    expect(parse<ErrorBody>(response.body).message).toBe('Approval not found');
  });

  it('returns 500 when the repository fails', async () => {
    findApproverByToken.mockRejectedValue(new Error('dynamo down'));
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const response = await invoke(approvalToken);

    expect(response.statusCode).toBe(500);
    expect(parse<ErrorBody>(response.body).message).toBe(
      'Internal server error',
    );

    consoleError.mockRestore();
  });
});
