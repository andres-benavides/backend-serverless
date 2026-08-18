import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  ApproverItem,
  PurchaseRequestItem,
} from '../../src/domain/purchase-request';
import { PurchaseRequestRepository } from '../../src/repositories/purchase-request.repository';

const endpoint = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';
const tableName = `purchase-approvals-it-${Date.now()}`;

process.env.DYNAMODB_ENDPOINT = endpoint;
process.env.AWS_REGION ??= 'us-east-1';
process.env.AWS_ACCESS_KEY_ID ??= 'local';
process.env.AWS_SECRET_ACCESS_KEY ??= 'local';

const enabled = process.env.RUN_INTEGRATION_TESTS === '1';

const admin = new DynamoDBClient({ endpoint });

const requestId = 'e2e-request';

const requestItem: PurchaseRequestItem = {
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
  GSI1SK: `CREATED_AT#2026-08-16T20:00:00.000Z#REQUEST#${requestId}`,
};

const approverItems: ApproverItem[] = [1, 2, 3].map((order) => ({
  PK: `REQUEST#${requestId}`,
  SK: `APPROVER#0${order}#approver-${order}`,
  entityType: 'APPROVER',
  requestId,
  approverId: `approver-${order}`,
  order,
  role: `Role ${order}`,
  name: `Approver ${order}`,
  email: `approver${order}@example.com`,
  status: 'PENDING',
  approvalToken: `token-${order}`,
  taskToken: `seed-task-${order}`,
  createdAt: '2026-08-16T20:00:00.000Z',
  updatedAt: '2026-08-16T20:00:00.000Z',
  GSI2PK: `APPROVAL_TOKEN#token-${order}`,
  GSI2SK: `REQUEST#${requestId}#APPROVER#approver-${order}`,
}));

describe.skipIf(!enabled)('PurchaseRequestRepository (DynamoDB Local)', () => {
  let repository: PurchaseRequestRepository;

  beforeAll(async () => {
    await admin.send(
      new CreateTableCommand({
        TableName: tableName,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          { AttributeName: 'PK', AttributeType: 'S' },
          { AttributeName: 'SK', AttributeType: 'S' },
          { AttributeName: 'GSI1PK', AttributeType: 'S' },
          { AttributeName: 'GSI1SK', AttributeType: 'S' },
          { AttributeName: 'GSI2PK', AttributeType: 'S' },
          { AttributeName: 'GSI2SK', AttributeType: 'S' },
        ],
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'GSI1',
            KeySchema: [
              { AttributeName: 'GSI1PK', KeyType: 'HASH' },
              { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
          {
            IndexName: 'GSI2',
            KeySchema: [
              { AttributeName: 'GSI2PK', KeyType: 'HASH' },
              { AttributeName: 'GSI2SK', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
        ],
      }),
    );

    repository = new PurchaseRequestRepository(tableName);
  });

  afterAll(async () => {
    await admin.send(new DeleteTableCommand({ TableName: tableName }));
  });

  it('writes the request and its approvers transactionally', async () => {
    await repository.create(requestItem, approverItems);

    const items = await repository.findById(requestId);

    expect(items).toHaveLength(4);
  });

  it('returns the metadata item and the three approvers', async () => {
    const items = await repository.findById(requestId);

    const metadata = items.filter(
      (item) => item.entityType === 'PURCHASE_REQUEST',
    );
    const approvers = items.filter((item) => item.entityType === 'APPROVER');

    expect(metadata).toHaveLength(1);
    expect(approvers).toHaveLength(3);
  });

  it('rejects writing the same request twice', async () => {
    await expect(
      repository.create(requestItem, approverItems),
    ).rejects.toThrow();
  });

  it('returns an empty list for an unknown request', async () => {
    const items = await repository.findById('does-not-exist');

    expect(items).toEqual([]);
  });

  it('queries requester requests through GSI1', async () => {
    const items = await repository.findByRequester('user-001');

    expect(items).toHaveLength(1);
    expect(items[0].requestId).toBe(requestId);
    expect(items[0].entityType).toBe('PURCHASE_REQUEST');
  });

  it('returns an empty list for an unknown requester', async () => {
    const items = await repository.findByRequester('does-not-exist');

    expect(items).toEqual([]);
  });

  it('finds the approver through GSI2 using its public token', async () => {
    const approver = await repository.findApproverByToken('token-2');

    expect(approver?.approverId).toBe('approver-2');
    expect(approver?.order).toBe(2);
    expect(approver?.requestId).toBe(requestId);
  });

  it('returns undefined for an unknown approval token', async () => {
    const approver = await repository.findApproverByToken(
      'token-does-not-exist',
    );

    expect(approver).toBeUndefined();
  });

  it('reads the request metadata item on its own', async () => {
    const metadata = await repository.findRequestMetadata(requestId);

    expect(metadata?.SK).toBe('METADATA');
    expect(metadata?.entityType).toBe('PURCHASE_REQUEST');
    expect(metadata?.currentApproverOrder).toBe(1);
  });

  it('returns undefined when the request metadata does not exist', async () => {
    const metadata = await repository.findRequestMetadata('does-not-exist');

    expect(metadata).toBeUndefined();
  });

  it('finds an approver by its order', async () => {
    const found = await repository.findApproverByOrder(requestId, 2);

    expect(found?.approverId).toBe('approver-2');
  });

  it('stores the execution arn on the metadata item', async () => {
    await repository.saveExecutionArn(requestId, 'arn:execution:1');

    const metadata = await repository.findRequestMetadata(requestId);

    expect(metadata?.executionArn).toBe('arn:execution:1');
  });

  it('activates an approver and advances the current order atomically', async () => {
    await repository.activateApprover(
      requestId,
      'APPROVER#02#approver-2',
      2,
      'task-token-2',
    );

    const approver = await repository.findApproverByOrder(requestId, 2);
    const metadata = await repository.findRequestMetadata(requestId);

    expect(approver?.taskToken).toBe('task-token-2');
    expect(approver?.activatedAt).toEqual(expect.any(String));
    expect(metadata?.currentApproverOrder).toBe(2);
  });

  it('moves the request to a final state only once', async () => {
    await repository.updateRequestStatus(requestId, 'COMPLETED');

    const metadata = await repository.findRequestMetadata(requestId);
    expect(metadata?.status).toBe('COMPLETED');

    await expect(
      repository.updateRequestStatus(requestId, 'REJECTED'),
    ).rejects.toThrow();
  });

  it('refuses to activate an approver once the request is closed', async () => {
    await expect(
      repository.activateApprover(
        requestId,
        'APPROVER#03#approver-3',
        3,
        'task-token-3',
      ),
    ).rejects.toThrow();
  });

  it('stores only the otp hash and resets the attempt counter', async () => {
    await repository.saveOtp(
      requestId,
      'APPROVER#01#approver-1',
      'hashed-code',
      '2099-01-01T00:00:00.000Z',
    );

    const approver = await repository.findApproverByOrder(requestId, 1);

    expect(approver?.otpHash).toBe('hashed-code');
    expect(approver?.otpAttempts).toBe(0);
    expect(approver?.otpVerifiedAt).toBeUndefined();
  });

  it('increments the attempt counter atomically', async () => {
    const results = await Promise.all([
      repository.incrementOtpAttempts(requestId, 'APPROVER#01#approver-1'),
      repository.incrementOtpAttempts(requestId, 'APPROVER#01#approver-1'),
      repository.incrementOtpAttempts(requestId, 'APPROVER#01#approver-1'),
    ]);

    expect(new Set(results).size).toBe(3);
    expect(Math.max(...results)).toBe(3);
  });

  it('clears the verification when a new otp is issued', async () => {
    await repository.markOtpVerified(
      requestId,
      'APPROVER#01#approver-1',
      '2026-08-17T10:00:00.000Z',
    );
    await repository.saveOtp(
      requestId,
      'APPROVER#01#approver-1',
      'another-hash',
      '2099-01-01T00:00:00.000Z',
    );

    const approver = await repository.findApproverByOrder(requestId, 1);

    expect(approver?.otpVerifiedAt).toBeUndefined();
    expect(approver?.otpAttempts).toBe(0);
  });

  it('refuses to record a decision before the otp is verified', async () => {
    await expect(
      repository.recordDecision(
        requestId,
        'APPROVER#01#approver-1',
        'SIGNED',
        '2026-08-17T10:00:00.000Z',
      ),
    ).rejects.toThrow();
  });

  it('records the decision once and rejects the second attempt', async () => {
    await repository.markOtpVerified(
      requestId,
      'APPROVER#01#approver-1',
      '2026-08-17T10:00:00.000Z',
    );

    const updated = await repository.recordDecision(
      requestId,
      'APPROVER#01#approver-1',
      'SIGNED',
      '2026-08-17T10:01:00.000Z',
    );

    expect(updated.status).toBe('SIGNED');
    expect(updated.signedAt).toBe('2026-08-17T10:01:00.000Z');
    expect(updated.taskToken).toBe('seed-task-1');

    await expect(
      repository.recordDecision(
        requestId,
        'APPROVER#01#approver-1',
        'REJECTED',
        '2026-08-17T10:02:00.000Z',
      ),
    ).rejects.toThrow();
  });

  it('only lets one of two simultaneous decisions win', async () => {
    await repository.markOtpVerified(
      requestId,
      'APPROVER#03#approver-3',
      '2026-08-17T10:00:00.000Z',
    );

    const results = await Promise.allSettled([
      repository.recordDecision(
        requestId,
        'APPROVER#03#approver-3',
        'SIGNED',
        '2026-08-17T10:01:00.000Z',
      ),
      repository.recordDecision(
        requestId,
        'APPROVER#03#approver-3',
        'REJECTED',
        '2026-08-17T10:01:00.000Z',
      ),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');

    expect(fulfilled).toHaveLength(1);
  });

  it('marks the callback as sent', async () => {
    await repository.markCallbackSent(
      requestId,
      'APPROVER#03#approver-3',
      '2026-08-17T10:05:00.000Z',
    );

    const approver = await repository.findApproverByOrder(requestId, 3);

    expect(approver?.callbackSentAt).toBe('2026-08-17T10:05:00.000Z');
  });

  it('stores the evidence key on the metadata item', async () => {
    await repository.saveEvidenceKey(
      requestId,
      'requests/e2e-request/evidence.pdf',
      '2026-08-17T10:10:00.000Z',
    );

    const metadata = await repository.findRequestMetadata(requestId);

    expect(metadata?.evidenceKey).toBe('requests/e2e-request/evidence.pdf');
    expect(metadata?.evidenceGeneratedAt).toBe('2026-08-17T10:10:00.000Z');
  });
});
