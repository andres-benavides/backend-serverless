import type { APIGatewayProxyHandler } from 'aws-lambda';
import { S3EvidenceStorage } from '../infrastructure/evidence-storage';
import { PurchaseRequestRepository } from '../repositories/purchase-request.repository';
import { GetEvidenceUrlService } from '../services/get-evidence-url.service';
import { jsonResponse } from '../shared/http';
import { toErrorResponse } from '../shared/http-errors';

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error('TABLE_NAME is required');

const bucket = process.env.EVIDENCE_BUCKET;
if (!bucket) throw new Error('EVIDENCE_BUCKET is required');

const service = new GetEvidenceUrlService(
  new PurchaseRequestRepository(tableName),
  new S3EvidenceStorage(bucket),
);

export const handler: APIGatewayProxyHandler = async (event) => {
  const requestId = event.pathParameters?.id;

  if (!requestId) {
    return jsonResponse(400, { message: 'Request id is required' });
  }

  try {
    const evidence = await service.execute(requestId);

    return jsonResponse(200, { evidence });
  } catch (error) {
    return toErrorResponse('get-evidence', error);
  }
};
