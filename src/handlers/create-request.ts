import type { APIGatewayProxyHandler } from 'aws-lambda';
import { ZodError } from 'zod';
import { PurchaseRequestRepository } from '../repositories/purchase-request.repository';
import { createRequestSchema } from '../schemas/create-request.schema';
import { CreatePurchaseRequestService } from '../services/create-purchase-request.service';
import { jsonResponse } from '../shared/http';

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error('TABLE_NAME is required');

const repository = new PurchaseRequestRepository(tableName);
const service = new CreatePurchaseRequestService(repository);

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    if (!event.body) {
      return jsonResponse(400, { message: 'Request body is required' });
    }

    const input = createRequestSchema.parse(JSON.parse(event.body));
    const result = await service.execute(input);

    return jsonResponse(201, {
      requestId: result.request.requestId,
      status: result.request.status,
      createdAt: result.request.createdAt,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonResponse(400, { message: 'Invalid JSON body' });
    }

    if (error instanceof ZodError) {
      return jsonResponse(422, {
        message: 'Validation failed',
        errors: error.issues,
      });
    }

    console.error('create-request failed', error);
    return jsonResponse(500, { message: 'Internal server error' });
  }
};
