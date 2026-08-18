import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import type * as Sfn from '@aws-sdk/client-sfn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { create, saveExecutionArn } = vi.hoisted(() => ({
  create: vi.fn(),
  saveExecutionArn: vi.fn(),
}));

const sfnMock = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('@aws-sdk/client-sfn', async () => {
  const actual = await vi.importActual<typeof Sfn>('@aws-sdk/client-sfn');

  return {
    ...actual,
    SFNClient: class {
      send = sfnMock.send;
    },
  };
});

vi.mock('../../src/repositories/purchase-request.repository', () => ({
  PurchaseRequestRepository: class {
    create = create;
    saveExecutionArn = saveExecutionArn;
  },
}));

import { handler } from '../../src/handlers/create-request';

interface CreatedBody {
  requestId: string;
  status: string;
  createdAt: string;
}

interface ErrorBody {
  message: string;
  errors?: unknown[];
}

const validBody = {
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

const invoke = async (body: string | null) => {
  const result = await handler(
    { body } as unknown as APIGatewayProxyEvent,
    {} as unknown as Context,
    () => undefined,
  );

  return result as APIGatewayProxyResult;
};

const parse = <T>(body: string) => JSON.parse(body) as T;

describe('create-request handler', () => {
  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue(undefined);
    saveExecutionArn.mockReset();
    saveExecutionArn.mockResolvedValue(undefined);
    sfnMock.send.mockReset();
    sfnMock.send.mockResolvedValue({ executionArn: 'arn:execution:1' });
  });

  it('returns 201 with the created request summary', async () => {
    const response = await invoke(JSON.stringify(validBody));
    const body = parse<CreatedBody>(response.body);

    expect(response.statusCode).toBe(201);
    expect(body.status).toBe('PENDING');
    expect(body.requestId).toEqual(expect.any(String));
    expect(body.createdAt).toEqual(expect.any(String));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('never leaks the approval token in the response', async () => {
    const response = await invoke(JSON.stringify(validBody));

    expect(response.body).not.toContain('approvalToken');
  });

  it('returns 400 when the body is missing', async () => {
    const response = await invoke(null);

    expect(response.statusCode).toBe(400);
    expect(parse<ErrorBody>(response.body).message).toBe(
      'Request body is required',
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('returns 400 when the body is not valid json', async () => {
    const response = await invoke('{ not json');

    expect(response.statusCode).toBe(400);
    expect(parse<ErrorBody>(response.body).message).toBe('Invalid JSON body');
  });

  it('returns 422 with the validation issues', async () => {
    const response = await invoke(JSON.stringify({ title: '' }));
    const body = parse<ErrorBody>(response.body);

    expect(response.statusCode).toBe(422);
    expect(body.message).toBe('Validation failed');
    expect(Array.isArray(body.errors)).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository fails', async () => {
    create.mockRejectedValue(new Error('dynamo is down'));
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const response = await invoke(JSON.stringify(validBody));

    expect(response.statusCode).toBe(500);
    expect(parse<ErrorBody>(response.body).message).toBe(
      'Internal server error',
    );

    consoleError.mockRestore();
  });

  it('starts the approval workflow and stores its execution arn', async () => {
    await invoke(JSON.stringify(validBody));

    expect(sfnMock.send).toHaveBeenCalledTimes(1);
    expect(saveExecutionArn).toHaveBeenCalledWith(
      expect.any(String),
      'arn:execution:1',
    );
  });

  it('never returns the execution arn to the client', async () => {
    const response = await invoke(JSON.stringify(validBody));

    expect(response.body).not.toContain('arn:execution:1');
  });

  it('returns 500 when the workflow cannot be started', async () => {
    sfnMock.send.mockRejectedValue(new Error('states unavailable'));
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const response = await invoke(JSON.stringify(validBody));

    expect(response.statusCode).toBe(500);

    consoleError.mockRestore();
  });
});
