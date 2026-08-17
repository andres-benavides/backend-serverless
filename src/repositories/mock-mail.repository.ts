import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { MockMailItem } from '../domain/purchase-request';
import { dynamodb } from '../shared/dynamodb';

export class MockMailRepository {
  constructor(private readonly tableName: string) {}

  async save(item: MockMailItem): Promise<void> {
    await dynamodb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );
  }

  async findRecent(limit: number): Promise<MockMailItem[]> {
    const result = await dynamodb.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :gsi1pk',
        ExpressionAttributeValues: {
          ':gsi1pk': 'MOCK_MAIL',
        },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );

    return (result.Items ?? []) as MockMailItem[];
  }

  async findByRequest(
    requestId: string,
    limit: number,
  ): Promise<MockMailItem[]> {
    const result = await dynamodb.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `REQUEST#${requestId}`,
          ':sk': 'MAIL#',
        },
        Limit: limit,
      }),
    );

    return (result.Items ?? []) as MockMailItem[];
  }
}
