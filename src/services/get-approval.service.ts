import type { ApprovalView } from '../domain/purchase-request';
import type { PurchaseRequestRepository } from '../repositories/purchase-request.repository';
import { NotFoundError } from '../shared/errors';

export class GetApprovalService {
  constructor(private readonly repository: PurchaseRequestRepository) {}

  async execute(approvalToken: string): Promise<ApprovalView> {
    const approver = await this.repository.findApproverByToken(approvalToken);

    if (!approver) {
      throw new NotFoundError('Approval not found');
    }

    const request = await this.repository.findRequestMetadata(
      approver.requestId,
    );

    if (!request) {
      throw new NotFoundError('Approval not found');
    }

    const active =
      request.status === 'PENDING' &&
      approver.status === 'PENDING' &&
      approver.order === request.currentApproverOrder;

    return {
      status: approver.status,
      active,
      requiresOtp: active,
    };
  }
}
