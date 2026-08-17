import { QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { dynamodb } from '../shared/dynamodb';
import type {
  ApproverItem,
  PurchaseRequestItem,
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
}
