import type { APIGatewayProxyHandler } from 'aws-lambda';
import { PurchaseRequestRepository } from '../repositories/purchase-request.repository';
import { GetPurchaseRequestService } from '../services/get-purchase-request.service';
import { NotFoundError } from '../shared/errors';
import { jsonResponse } from '../shared/http';

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error('TABLE_NAME is required');

const repository = new PurchaseRequestRepository(tableName);
const service = new GetPurchaseRequestService(repository);

export const handler: APIGatewayProxyHandler = async (event) => {
  const requestId = event.pathParameters?.id;

  if (!requestId) {
    return jsonResponse(400, { message: 'Request id is required' });
  }

  try {
    const detail = await service.execute(requestId);

    return jsonResponse(200, detail);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return jsonResponse(404, { message: error.message });
    }

    console.error('get-request failed', error);
    return jsonResponse(500, { message: 'Internal server error' });
  }
};
