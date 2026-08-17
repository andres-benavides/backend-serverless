import type { APIGatewayProxyHandler } from 'aws-lambda';
import { PurchaseRequestRepository } from '../repositories/purchase-request.repository';
import { approvalTokenParamsSchema } from '../schemas/approval-token.schema';
import { verifyOtpBodySchema } from '../schemas/verify-otp.schema';
import { VerifyOtpService } from '../services/verify-otp.service';
import { toErrorResponse } from '../shared/http-errors';
import { jsonResponse } from '../shared/http';

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error('TABLE_NAME is required');

const service = new VerifyOtpService(new PurchaseRequestRepository(tableName));

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { approvalToken } = approvalTokenParamsSchema.parse(
      event.pathParameters ?? {},
    );
    const { otp } = verifyOtpBodySchema.parse(
      JSON.parse(event.body ?? '{}') as unknown,
    );

    const purchase = await service.execute(approvalToken, otp);

    return jsonResponse(200, { purchase });
  } catch (error) {
    return toErrorResponse('verify-otp', error);
  }
};
