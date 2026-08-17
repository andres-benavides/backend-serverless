import {
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { dynamodb } from '../shared/dynamodb';
import type {
  ApproverItem,
  PurchaseRequestItem,
  RequestStatus,
} from '../domain/purchase-request';

export class PurchaseRequestRepository {
  constructor(private readonly tableName: string) {}

  async create(
    request: PurchaseRequestItem,
    approvers: ApproverItem[],
  ): Promise<void> {
    await dynamodb.send(
      new TransactWriteCommand({
        TransactItems: [request, ...approvers].map((item) => ({
          Put: {
            TableName: this.tableName,
            Item: item,
            ConditionExpression:
              'attribute_not_exists(PK) AND attribute_not_exists(SK)',
          },
        })),
      }),
    );
  }

  async findById(
    requestId: string,
  ): Promise<Array<PurchaseRequestItem | ApproverItem>> {
    const result = await dynamodb.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `REQUEST#${requestId}`,
        },
      }),
    );

    return (result.Items ?? []) as Array<PurchaseRequestItem | ApproverItem>;
  }

  async findByRequester(requesterId: string): Promise<PurchaseRequestItem[]> {
    const requests: PurchaseRequestItem[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const result = await dynamodb.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :gsi1pk',
          ExpressionAttributeValues: {
            ':gsi1pk': `REQUESTER#${requesterId}`,
          },
          ScanIndexForward: false,
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );

      requests.push(...((result.Items ?? []) as PurchaseRequestItem[]));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);

    return requests;
  }

  async findApproverByToken(
    approvalToken: string,
  ): Promise<ApproverItem | undefined> {
    const result = await dynamodb.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :gsi2pk',
        ExpressionAttributeValues: {
          ':gsi2pk': `APPROVAL_TOKEN#${approvalToken}`,
        },
        Limit: 1,
      }),
    );

    return (result.Items ?? [])[0] as ApproverItem | undefined;
  }

  async findRequestMetadata(
    requestId: string,
  ): Promise<PurchaseRequestItem | undefined> {
    const result = await dynamodb.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': `REQUEST#${requestId}`,
          ':sk': 'METADATA',
        },
        Limit: 1,
      }),
    );

    return (result.Items ?? [])[0] as PurchaseRequestItem | undefined;
  }

  async findApproverByOrder(
    requestId: string,
    order: number,
  ): Promise<ApproverItem | undefined> {
    const result = await dynamodb.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `REQUEST#${requestId}`,
          ':sk': `APPROVER#${String(order).padStart(2, '0')}#`,
        },
        Limit: 1,
      }),
    );

    return (result.Items ?? [])[0] as ApproverItem | undefined;
  }

  async saveExecutionArn(
    requestId: string,
    executionArn: string,
  ): Promise<void> {
    await dynamodb.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: `REQUEST#${requestId}`, SK: 'METADATA' },
        UpdateExpression:
          'SET executionArn = :executionArn, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':executionArn': executionArn,
          ':updatedAt': new Date().toISOString(),
        },
      }),
    );
  }

  async activateApprover(
    requestId: string,
    approverSortKey: string,
    order: number,
    taskToken: string,
  ): Promise<void> {
    const now = new Date().toISOString();

    await dynamodb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: this.tableName,
              Key: { PK: `REQUEST#${requestId}`, SK: approverSortKey },
              UpdateExpression:
                'SET taskToken = :taskToken, activatedAt = :now, updatedAt = :now',
              ConditionExpression: '#status = :pending',
              ExpressionAttributeNames: { '#status': 'status' },
              ExpressionAttributeValues: {
                ':taskToken': taskToken,
                ':now': now,
                ':pending': 'PENDING',
              },
            },
          },
          {
            Update: {
              TableName: this.tableName,
              Key: { PK: `REQUEST#${requestId}`, SK: 'METADATA' },
              UpdateExpression:
                'SET currentApproverOrder = :order, updatedAt = :now',
              ConditionExpression: '#status = :pending',
              ExpressionAttributeNames: { '#status': 'status' },
              ExpressionAttributeValues: {
                ':order': order,
                ':now': now,
                ':pending': 'PENDING',
              },
            },
          },
        ],
      }),
    );
  }

  async updateRequestStatus(
    requestId: string,
    status: RequestStatus,
  ): Promise<void> {
    await dynamodb.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: `REQUEST#${requestId}`, SK: 'METADATA' },
        UpdateExpression: 'SET #status = :status, updatedAt = :now',
        ConditionExpression: '#status = :pending',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': status,
          ':pending': 'PENDING',
          ':now': new Date().toISOString(),
        },
      }),
    );
  }

  async saveOtp(
    requestId: string,
    approverSortKey: string,
    otpHash: string,
    expiresAt: string,
  ): Promise<void> {
    await dynamodb.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: `REQUEST#${requestId}`, SK: approverSortKey },
        UpdateExpression:
          'SET otpHash = :otpHash, otpExpiresAt = :expiresAt, otpAttempts = :zero, updatedAt = :now REMOVE otpVerifiedAt',
        ConditionExpression: '#status = :pending',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':otpHash': otpHash,
          ':expiresAt': expiresAt,
          ':zero': 0,
          ':pending': 'PENDING',
          ':now': new Date().toISOString(),
        },
      }),
    );
  }

  async incrementOtpAttempts(
    requestId: string,
    approverSortKey: string,
  ): Promise<number> {
    const result = await dynamodb.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: `REQUEST#${requestId}`, SK: approverSortKey },
        UpdateExpression:
          'SET otpAttempts = if_not_exists(otpAttempts, :zero) + :one, updatedAt = :now',
        ExpressionAttributeValues: {
          ':zero': 0,
          ':one': 1,
          ':now': new Date().toISOString(),
        },
        ReturnValues: 'UPDATED_NEW',
      }),
    );

    return (result.Attributes?.otpAttempts as number | undefined) ?? 0;
  }

  async markOtpVerified(
    requestId: string,
    approverSortKey: string,
    verifiedAt: string,
  ): Promise<void> {
    await dynamodb.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: `REQUEST#${requestId}`, SK: approverSortKey },
        UpdateExpression:
          'SET otpVerifiedAt = :verifiedAt, updatedAt = :verifiedAt',
        ConditionExpression: '#status = :pending',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':verifiedAt': verifiedAt,
          ':pending': 'PENDING',
        },
      }),
    );
  }
}
