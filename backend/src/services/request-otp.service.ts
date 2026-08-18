import type { MailSender } from '../infrastructure/mail-sender';
import type { PurchaseRequestRepository } from '../repositories/purchase-request.repository';
import { ConflictError } from '../shared/errors';
import { generateOtp, hashOtp, otpExpiresAt } from '../shared/otp';
import { loadApprovalContext } from './approval-context';

type OtpMailSender = Pick<MailSender, 'sendOtpMail'>;

export interface RequestOtpResult {
  expiresAt: string;
}

export class RequestOtpService {
  constructor(
    private readonly repository: PurchaseRequestRepository,
    private readonly mailSender?: OtpMailSender,
  ) {}

  async execute(approvalToken: string): Promise<RequestOtpResult> {
    const { approver, active } = await loadApprovalContext(
      this.repository,
      approvalToken,
    );

    if (!active) {
      throw new ConflictError('This approval is not active');
    }

    const otp = generateOtp();
    const expiresAt = otpExpiresAt(new Date());

    await this.repository.saveOtp(
      approver.requestId,
      approver.SK,
      hashOtp(approver.approverId, otp),
      expiresAt,
    );

    if (this.mailSender) {
      await this.mailSender.sendOtpMail({
        requestId: approver.requestId,
        approverId: approver.approverId,
        to: approver.email,
        approverName: approver.name,
        role: approver.role,
        order: approver.order,
        approvalToken,
        otp,
        otpExpiresAt: expiresAt,
      });
    }

    return { expiresAt };
  }
}
