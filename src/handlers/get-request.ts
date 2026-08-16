import type { APIGatewayProxyHandler } from 'aws-lambda';
import { PurchaseRequestRepository } from '../repositories/purchase-request.repository';
import { jsonResponse } from '../shared/http';

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error('TABLE_NAME is required');

const repository = new PurchaseRequestRepository(tableName);

export const handler: APIGatewayProxyHandler = async (event) => {
  const requestId = event.pathParameters?.id;

  if (!requestId) {
    return jsonResponse(400, { message: 'Request id is required' });
  }

  try {
    const items = await repository.findById(requestId);

    if (items.length === 0) {
      return jsonResponse(404, { message: 'Purchase request not found' });
    }

    const request = items.find((item) => item.entityType === 'PURCHASE_REQUEST');
    const approvers = items
      .filter((item) => item.entityType === 'APPROVER')
      .sort((a, b) => {
        if (a.entityType !== 'APPROVER' || b.entityType !== 'APPROVER') return 0;
        return a.order - b.order;
      })
      .map((item) => {
        if (item.entityType !== 'APPROVER') return item;
        const { approvalToken: _approvalToken, GSI2PK: _gsi2pk, GSI2SK: _gsi2sk, ...safe } = item;
        return safe;
      });

    return jsonResponse(200, { request, approvers });
  } catch (error) {
    console.error('get-request failed', error);
    return jsonResponse(500, { message: 'Internal server error' });
  }
};
