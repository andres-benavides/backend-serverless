import { S3EvidenceStorage } from '../infrastructure/evidence-storage';
import { PurchaseRequestRepository } from '../repositories/purchase-request.repository';
import { GenerateEvidenceService } from '../services/generate-evidence.service';

interface GenerateEvidenceInput {
  requestId: string;
}

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error('TABLE_NAME is required');

const bucket = process.env.EVIDENCE_BUCKET;
if (!bucket) throw new Error('EVIDENCE_BUCKET is required');

const service = new GenerateEvidenceService(
  new PurchaseRequestRepository(tableName),
  new S3EvidenceStorage(bucket),
);

export const handler = async (
  event: GenerateEvidenceInput,
): Promise<{ evidenceKey: string }> => {
  const result = await service.execute(event.requestId);

  console.log(
    JSON.stringify({
      operation: 'generate-evidence',
      requestId: event.requestId,
      evidenceKey: result.evidenceKey,
    }),
  );

  return { evidenceKey: result.evidenceKey };
};
