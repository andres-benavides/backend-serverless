import type { APIGatewayProxyHandler } from 'aws-lambda';
import { ZodError } from 'zod';
import { PurchaseRequestRepository } from '../repositories/purchase-request.repository';
import { listRequestsQuerySchema } from '../schemas/list-requests.schema';
import { ListPurchaseRequestsService } from '../services/list-purchase-requests.service';
import { jsonResponse } from '../shared/http';

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error('TABLE_NAME is required');

const repository = new PurchaseRequestRepository(tableName);
const service = new ListPurchaseRequestsService(repository);

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { requesterId } = listRequestsQuerySchema.parse(
      event.queryStringParameters ?? {},
    );
    const requests = await service.execute(requesterId);

    return jsonResponse(200, { requests });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonResponse(400, {
        message: 'Validation failed',
        errors: error.issues,
      });
    }

    console.error('list-requests failed', error);
    return jsonResponse(500, { message: 'Internal server error' });
  }
};
