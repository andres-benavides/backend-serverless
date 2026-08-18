import type {
  ApproverItem,
  PurchaseRequestItem,
} from '../domain/purchase-request';
import type { PurchaseRequestRepository } from '../repositories/purchase-request.repository';
import { NotFoundError } from '../shared/errors';

export interface ApprovalContext {
  approver: ApproverItem;
  request: PurchaseRequestItem;
  active: boolean;
}

export const loadApprovalContext = async (
  repository: PurchaseRequestRepository,
  approvalToken: string,
): Promise<ApprovalContext> => {
  const approver = await repository.findApproverByToken(approvalToken);

  if (!approver) {
    throw new NotFoundError('Approval not found');
  }

  const request = await repository.findRequestMetadata(approver.requestId);

  if (!request) {
    throw new NotFoundError('Approval not found');
  }

  const active =
    request.status === 'PENDING' &&
    approver.status === 'PENDING' &&
    approver.order === request.currentApproverOrder;

  return { approver, request, active };
};
