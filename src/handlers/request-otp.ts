import type { APIGatewayProxyHandler } from 'aws-lambda';
import { MockMailSender } from '../infrastructure/mail-sender';
import { MockMailRepository } from '../repositories/mock-mail.repository';
import { PurchaseRequestRepository } from '../repositories/purchase-request.repository';
import { approvalTokenParamsSchema } from '../schemas/approval-token.schema';
import { RequestOtpService } from '../services/request-otp.service';
import { toErrorResponse } from '../shared/http-errors';
import { jsonResponse } from '../shared/http';

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error('TABLE_NAME is required');

const appBaseUrl = process.env.APP_BASE_URL ?? 'https://dominio.com';

const service = new RequestOtpService(
  new PurchaseRequestRepository(tableName),
  new MockMailSender(new MockMailRepository(tableName), appBaseUrl),
);

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { approvalToken } = approvalTokenParamsSchema.parse(
      event.pathParameters ?? {},
    );

    const { expiresAt } = await service.execute(approvalToken);

    return jsonResponse(201, { otp: { expiresAt } });
  } catch (error) {
    return toErrorResponse('request-otp', error);
  }
};
