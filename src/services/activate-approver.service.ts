import type { PurchaseRequestRepository } from '../repositories/purchase-request.repository';
import { NotFoundError } from '../shared/errors';

export interface ActivateApproverInput {
  requestId: string;
  order: number;
  taskToken: string;
}

export class ActivateApproverService {
  constructor(private readonly repository: PurchaseRequestRepository) {}

  async execute({
    requestId,
    order,
    taskToken,
  }: ActivateApproverInput): Promise<void> {
    const approver = await this.repository.findApproverByOrder(
      requestId,
      order,
    );

    if (!approver) {
      throw new NotFoundError(
        `Approver ${String(order)} not found for request ${requestId}`,
      );
    }

    await this.repository.activateApprover(
      requestId,
      approver.SK,
      order,
      taskToken,
    );
  }
}
