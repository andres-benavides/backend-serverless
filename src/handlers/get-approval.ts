import type { APIGatewayProxyHandler } from 'aws-lambda';
import { ZodError } from 'zod';
import { PurchaseRequestRepository } from '../repositories/purchase-request.repository';
import { approvalTokenParamsSchema } from '../schemas/approval-token.schema';
import { GetApprovalService } from '../services/get-approval.service';
import { NotFoundError } from '../shared/errors';
import { jsonResponse } from '../shared/http';

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error('TABLE_NAME is required');

const repository = new PurchaseRequestRepository(tableName);
const service = new GetApprovalService(repository);

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { approvalToken } = approvalTokenParamsSchema.parse(
      event.pathParameters ?? {},
    );

    const approval = await service.execute(approvalToken);

    return jsonResponse(200, { approval });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonResponse(400, {
        message: 'Validation failed',
        errors: error.issues,
      });
    }

    if (error instanceof NotFoundError) {
      return jsonResponse(404, { message: error.message });
    }

    console.error('get-approval failed', error);
    return jsonResponse(500, { message: 'Internal server error' });
  }
};
