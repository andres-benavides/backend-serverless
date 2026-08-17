import type {
  ApprovalDecision,
  ApprovalStatus,
  ApproverItem,
} from '../domain/purchase-request';
import type { ApprovalWorkflow } from '../infrastructure/approval-workflow';
import type { PurchaseRequestRepository } from '../repositories/purchase-request.repository';
import { ConflictError, NotFoundError } from '../shared/errors';

type DecisionReporter = Pick<ApprovalWorkflow, 'reportDecision'>;

type FinalStatus = Extract<ApprovalStatus, 'SIGNED' | 'REJECTED'>;

export interface SubmitDecisionResult {
  status: FinalStatus;
  decidedAt: string;
}

const targetStatus = (decision: ApprovalDecision): FinalStatus =>
  decision === 'APPROVE' ? 'SIGNED' : 'REJECTED';

export class SubmitDecisionService {
  constructor(
    private readonly repository: PurchaseRequestRepository,
    private readonly workflow: DecisionReporter,
  ) {}

  async execute(
    approvalToken: string,
    decision: ApprovalDecision,
    now = new Date(),
  ): Promise<SubmitDecisionResult> {
    const approver = await this.repository.findApproverByToken(approvalToken);

    if (!approver) {
      throw new NotFoundError('Approval not found');
    }

    const target = targetStatus(decision);

    if (approver.status === 'PENDING') {
      if (!approver.otpVerifiedAt) {
        throw new ConflictError('The OTP must be verified before deciding');
      }

      const updated = await this.repository.recordDecision(
        approver.requestId,
        approver.SK,
        target,
        now.toISOString(),
      );

      await this.deliverCallback(updated, target, now);

      return {
        status: target,
        decidedAt: this.decidedAt(updated, now),
      };
    }

    if (approver.status === target && !approver.callbackSentAt) {
      await this.deliverCallback(approver, target, now);

      return {
        status: target,
        decidedAt: this.decidedAt(approver, now),
      };
    }

    throw new ConflictError('This approval has already been processed');
  }

  private decidedAt(approver: ApproverItem, now: Date): string {
    return approver.signedAt ?? approver.rejectedAt ?? now.toISOString();
  }

  private async deliverCallback(
    approver: ApproverItem,
    target: FinalStatus,
    now: Date,
  ): Promise<void> {
    if (!approver.taskToken) {
      throw new ConflictError('This approval has no pending workflow task');
    }

    await this.workflow.reportDecision(
      approver.taskToken,
      target === 'SIGNED' ? 'APPROVED' : 'REJECTED',
    );

    await this.repository.markCallbackSent(
      approver.requestId,
      approver.SK,
      now.toISOString(),
    );
  }
}
