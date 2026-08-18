import type { MailSender } from '../infrastructure/mail-sender';
import type { PurchaseRequestRepository } from '../repositories/purchase-request.repository';
import { NotFoundError } from '../shared/errors';

type ApprovalMailSender = Pick<MailSender, 'sendApprovalMail'>;

export interface ActivateApproverInput {
  requestId: string;
  order: number;
  taskToken: string;
}

export class ActivateApproverService {
  constructor(
    private readonly repository: PurchaseRequestRepository,
    private readonly mailSender?: ApprovalMailSender,
  ) {}

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

    if (this.mailSender) {
      await this.mailSender.sendApprovalMail({
        requestId,
        approverId: approver.approverId,
        to: approver.email,
        approverName: approver.name,
        role: approver.role,
        order: approver.order,
        approvalToken: approver.approvalToken,
      });
    }
  }
}
