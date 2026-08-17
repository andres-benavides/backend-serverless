import type { ApprovalView } from '../domain/purchase-request';
import type { PurchaseRequestRepository } from '../repositories/purchase-request.repository';
import { loadApprovalContext } from './approval-context';

export class GetApprovalService {
  constructor(private readonly repository: PurchaseRequestRepository) {}

  async execute(approvalToken: string): Promise<ApprovalView> {
    const { approver, active } = await loadApprovalContext(
      this.repository,
      approvalToken,
    );

    return {
      status: approver.status,
      active,
      requiresOtp: active && !approver.otpVerifiedAt,
    };
  }
}
