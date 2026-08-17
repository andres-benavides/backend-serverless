import type {
  ApproverItem,
  ApproverSummary,
  PurchaseRequestDetail,
  PurchaseRequestItem,
  PurchaseRequestSummary,
} from '../domain/purchase-request';
import type { PurchaseRequestRepository } from '../repositories/purchase-request.repository';
import { NotFoundError } from '../shared/errors';

const toRequestSummary = (
  item: PurchaseRequestItem,
): PurchaseRequestSummary => {
  const {
    PK: _pk,
    SK: _sk,
    entityType: _entityType,
    executionArn: _executionArn,
    GSI1PK: _gsi1pk,
    GSI1SK: _gsi1sk,
    ...summary
  } = item;

  return summary;
};

const toApproverSummary = (item: ApproverItem): ApproverSummary => {
  const {
    PK: _pk,
    SK: _sk,
    entityType: _entityType,
    approvalToken: _approvalToken,
    taskToken: _taskToken,
    otpHash: _otpHash,
    otpExpiresAt: _otpExpiresAt,
    otpAttempts: _otpAttempts,
    GSI2PK: _gsi2pk,
    GSI2SK: _gsi2sk,
    ...summary
  } = item;

  return summary;
};

export class GetPurchaseRequestService {
  constructor(private readonly repository: PurchaseRequestRepository) {}

  async execute(requestId: string): Promise<PurchaseRequestDetail> {
    const items = await this.repository.findById(requestId);

    const metadata = items.find(
      (item): item is PurchaseRequestItem =>
        item.entityType === 'PURCHASE_REQUEST',
    );

    if (!metadata) {
      throw new NotFoundError('Purchase request not found');
    }

    const approvers = items
      .filter((item): item is ApproverItem => item.entityType === 'APPROVER')
      .sort((a, b) => a.order - b.order)
      .map(toApproverSummary);

    return {
      request: toRequestSummary(metadata),
      approvers,
    };
  }
}
