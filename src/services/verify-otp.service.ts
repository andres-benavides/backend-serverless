import type { PurchaseDetailForApprover } from '../domain/purchase-request';
import type { PurchaseRequestRepository } from '../repositories/purchase-request.repository';
import { ConflictError, UnauthorizedError } from '../shared/errors';
import { OTP_MAX_ATTEMPTS, isExpired, otpMatches } from '../shared/otp';
import { loadApprovalContext } from './approval-context';

export class VerifyOtpService {
  constructor(private readonly repository: PurchaseRequestRepository) {}

  async execute(
    approvalToken: string,
    otp: string,
    now = new Date(),
  ): Promise<PurchaseDetailForApprover> {
    const { approver, request, active } = await loadApprovalContext(
      this.repository,
      approvalToken,
    );

    if (!active) {
      throw new ConflictError('This approval is not active');
    }

    if (!approver.otpHash || !approver.otpExpiresAt) {
      throw new ConflictError('No OTP has been requested for this approval');
    }

    if ((approver.otpAttempts ?? 0) >= OTP_MAX_ATTEMPTS) {
      throw new ConflictError('Too many OTP attempts, request a new code');
    }

    if (isExpired(approver.otpExpiresAt, now)) {
      throw new ConflictError('The OTP has expired, request a new code');
    }

    if (!otpMatches(approver.approverId, otp, approver.otpHash)) {
      const attempts = await this.repository.incrementOtpAttempts(
        approver.requestId,
        approver.SK,
      );

      throw new UnauthorizedError('Invalid OTP', {
        attemptsLeft: Math.max(OTP_MAX_ATTEMPTS - attempts, 0),
      });
    }

    await this.repository.markOtpVerified(
      approver.requestId,
      approver.SK,
      now.toISOString(),
    );

    return {
      requestId: request.requestId,
      title: request.title,
      description: request.description,
      amount: request.amount,
      createdAt: request.createdAt,
      requester: request.requester,
      approver: {
        name: approver.name,
        role: approver.role,
        order: approver.order,
      },
    };
  }
}
