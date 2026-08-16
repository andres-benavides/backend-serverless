import { QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { dynamodb } from '../shared/dynamodb';
import type { ApproverItem, PurchaseRequestItem } from '../domain/purchase-request';

export class PurchaseRequestRepository {
  constructor(private readonly tableName: string) {}

  async create(
    request: PurchaseRequestItem,
    approvers: ApproverItem[]
  ): Promise<void> {
    await dynamodb.send(
      new TransactWriteCommand({
        TransactItems: [request, ...approvers].map((item) => ({
          Put: {
            TableName: this.tableName,
            Item: item,
            ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
          },
        })),
      })
    );
  }

  async findById(requestId: string): Promise<Array<PurchaseRequestItem | ApproverItem>> {
    const result = await dynamodb.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `REQUEST#${requestId}`,
        },
      })
    );

    return (result.Items ?? []) as Array<PurchaseRequestItem | ApproverItem>;
  }
}
