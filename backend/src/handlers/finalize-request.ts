import type { RequestStatus } from '../domain/purchase-request';
import { PurchaseRequestRepository } from '../repositories/purchase-request.repository';

interface FinalizeRequestInput {
  requestId: string;
  status: Extract<RequestStatus, 'COMPLETED' | 'REJECTED'>;
}

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error('TABLE_NAME is required');

const repository = new PurchaseRequestRepository(tableName);

export const handler = async (
  event: FinalizeRequestInput,
): Promise<{ status: RequestStatus }> => {
  console.log(
    JSON.stringify({
      operation: 'finalize-request',
      requestId: event.requestId,
      status: event.status,
    }),
  );

  await repository.updateRequestStatus(event.requestId, event.status);

  return { status: event.status };
};
