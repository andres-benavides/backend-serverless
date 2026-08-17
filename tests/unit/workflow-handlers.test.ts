import {
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dynamoMock = vi.hoisted(() => ({ send: vi.fn() }));
const s3Mock = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('../../src/shared/dynamodb', () => ({
  dynamodb: { send: dynamoMock.send },
}));

vi.mock('@aws-sdk/client-s3', async () => {
  const actual = await vi.importActual('@aws-sdk/client-s3');

  return {
    ...actual,
    S3Client: class {
      send = s3Mock.send;
    },
  };
});

import { handler as activateApprover } from '../../src/handlers/activate-approver';
import { handler as generateEvidence } from '../../src/handlers/generate-evidence';

const requestId = 'req-1';

const approver = {
  PK: `REQUEST#${requestId}`,
  SK: 'APPROVER#02#approver-2',
  entityType: 'APPROVER',
  requestId,
  approverId: 'approver-2',
  order: 2,
  role: 'Finance',
  name: 'Approver Two',
  email: 'two@example.com',
  status: 'SIGNED',
  approvalToken: 'token-2',
  signedAt: '2026-08-17T09:30:00.000Z',
  createdAt: '2026-08-17T09:00:00.000Z',
  updatedAt: '2026-08-17T09:00:00.000Z',
  GSI2PK: 'APPROVAL_TOKEN#token-2',
  GSI2SK: `REQUEST#${requestId}#APPROVER#approver-2`,
};

const request = {
  PK: `REQUEST#${requestId}`,
  SK: 'METADATA',
  entityType: 'PURCHASE_REQUEST',
  requestId,
  title: 'Compra',
  description: 'Tres equipos',
  amount: 15000000,
  requester: { id: 'user-001', name: 'Demo', email: 'demo@example.com' },
  status: 'PENDING',
  currentApproverOrder: 3,
  createdAt: '2026-08-17T09:00:00.000Z',
  updatedAt: '2026-08-17T09:00:00.000Z',
  GSI1PK: 'REQUESTER#user-001',
  GSI1SK: 'CREATED_AT#2026-08-17T09:00:00.000Z#REQUEST#req-1',
};

const sentCommands = () =>
  dynamoMock.send.mock.calls.map((call) => call[0] as object);

const commandsOfType = (type: unknown) =>
  sentCommands().filter((command) => command instanceof (type as never));

describe('activate-approver handler', () => {
  beforeEach(() => {
    dynamoMock.send.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    dynamoMock.send.mockImplementation((command: object) => {
      if (command instanceof QueryCommand) {
        return Promise.resolve({ Items: [{ ...approver, status: 'PENDING' }] });
      }

      return Promise.resolve({});
    });
  });

  it('stores the task token and sends the approval mail', async () => {
    await activateApprover({ requestId, order: 2, taskToken: 'task-token-2' });

    expect(commandsOfType(TransactWriteCommand)).toHaveLength(1);
    expect(commandsOfType(PutCommand)).toHaveLength(1);
  });

  it('writes the task token against the right approver', async () => {
    await activateApprover({ requestId, order: 2, taskToken: 'task-token-2' });

    const transact = commandsOfType(TransactWriteCommand)[0] as {
      input: {
        TransactItems: {
          Update: {
            Key: Record<string, string>;
            ExpressionAttributeValues: Record<string, unknown>;
          };
        }[];
      };
    };

    expect(transact.input.TransactItems[0].Update.Key.SK).toBe(
      'APPROVER#02#approver-2',
    );
    expect(
      transact.input.TransactItems[0].Update.ExpressionAttributeValues[
        ':taskToken'
      ],
    ).toBe('task-token-2');
  });

  it('mails the public approval token, never the task token', async () => {
    await activateApprover({ requestId, order: 2, taskToken: 'task-token-2' });

    const put = commandsOfType(PutCommand)[0] as {
      input: { Item: { approvalLink: string; mailType: string } };
    };

    expect(put.input.Item.mailType).toBe('APPROVAL_LINK');
    expect(put.input.Item.approvalLink).toContain('approver_token=token-2');
    expect(put.input.Item.approvalLink).not.toContain('task-token-2');
  });

  it('never logs the task token', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await activateApprover({ requestId, order: 2, taskToken: 'task-token-2' });

    const logged = log.mock.calls.map((call) => String(call[0])).join(' ');
    expect(logged).not.toContain('task-token-2');
  });

  it('fails loudly when the approver is missing', async () => {
    dynamoMock.send.mockResolvedValue({ Items: [] });

    await expect(
      activateApprover({ requestId, order: 2, taskToken: 'task-token-2' }),
    ).rejects.toThrow();
    expect(commandsOfType(PutCommand)).toHaveLength(0);
  });

  it('does not send mail when the activation is refused', async () => {
    dynamoMock.send.mockImplementation((command: object) => {
      if (command instanceof QueryCommand) {
        return Promise.resolve({ Items: [{ ...approver, status: 'PENDING' }] });
      }

      return Promise.reject(new Error('ConditionalCheckFailed'));
    });

    await expect(
      activateApprover({ requestId, order: 2, taskToken: 'task-token-2' }),
    ).rejects.toThrow('ConditionalCheckFailed');
    expect(commandsOfType(PutCommand)).toHaveLength(0);
  });
});

describe('generate-evidence handler', () => {
  beforeEach(() => {
    dynamoMock.send.mockReset();
    s3Mock.send.mockReset().mockResolvedValue({});
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    dynamoMock.send.mockImplementation((command: object) => {
      if (command instanceof QueryCommand) {
        return Promise.resolve({ Items: [request, approver] });
      }

      return Promise.resolve({});
    });
  });

  it('returns the deterministic evidence key', async () => {
    const result = await generateEvidence({ requestId });

    expect(result).toEqual({ evidenceKey: 'requests/req-1/evidence.pdf' });
    expect(s3Mock.send).toHaveBeenCalledTimes(1);
  });

  it('uploads real pdf bytes to the request prefix', async () => {
    await generateEvidence({ requestId });

    const command = s3Mock.send.mock.calls[0][0] as {
      input: { Key: string; Body: Uint8Array; ContentType: string };
    };

    expect(command.input.Key).toBe('requests/req-1/evidence.pdf');
    expect(command.input.ContentType).toBe('application/pdf');
    expect(Buffer.from(command.input.Body.slice(0, 5)).toString()).toBe(
      '%PDF-',
    );
  });

  it('records the key in dynamodb after the upload', async () => {
    await generateEvidence({ requestId });

    expect(commandsOfType(UpdateCommand)).toHaveLength(1);
  });

  it('is idempotent across retries', async () => {
    const first = await generateEvidence({ requestId });
    const second = await generateEvidence({ requestId });

    expect(first.evidenceKey).toBe(second.evidenceKey);
  });

  it('does not record the key when the upload fails', async () => {
    s3Mock.send.mockRejectedValue(new Error('access denied'));

    await expect(generateEvidence({ requestId })).rejects.toThrow(
      'access denied',
    );
    expect(commandsOfType(UpdateCommand)).toHaveLength(0);
  });

  it('fails when the request cannot be read', async () => {
    dynamoMock.send.mockResolvedValue({ Items: [] });

    await expect(generateEvidence({ requestId })).rejects.toThrow();
    expect(s3Mock.send).not.toHaveBeenCalled();
  });
});
