import { randomUUID } from 'node:crypto';
import type { MockMailItem } from '../domain/purchase-request';
import type { MockMailRepository } from '../repositories/mock-mail.repository';

export interface ApprovalMail {
  requestId: string;
  approverId: string;
  to: string;
  approverName: string;
  role: string;
  order: number;
  approvalToken: string;
}

export interface OtpMail {
  requestId: string;
  approverId: string;
  to: string;
  approverName: string;
  role: string;
  order: number;
  approvalToken: string;
  otp: string;
  otpExpiresAt: string;
}

export interface MailSender {
  sendApprovalMail(mail: ApprovalMail): Promise<void>;
  sendOtpMail(mail: OtpMail): Promise<void>;
}

export class MockMailSender implements MailSender {
  constructor(
    private readonly repository: MockMailRepository,
    private readonly appBaseUrl: string,
  ) {}

  async sendApprovalMail(mail: ApprovalMail): Promise<void> {
    const sentAt = new Date().toISOString();
    const mailId = randomUUID();
    const approvalLink = `${this.appBaseUrl}/approve?solicitud_id=${mail.requestId}&approver_token=${mail.approvalToken}`;

    const item: MockMailItem = {
      PK: `REQUEST#${mail.requestId}`,
      SK: `MAIL#${mail.approverId}`,
      entityType: 'MOCK_MAIL',
      mailType: 'APPROVAL_LINK',
      mailId,
      requestId: mail.requestId,
      approverId: mail.approverId,
      to: mail.to,
      approverName: mail.approverName,
      role: mail.role,
      order: mail.order,
      subject: `Aprobacion pendiente de la solicitud ${mail.requestId}`,
      approvalLink,
      sentAt,
      GSI1PK: 'MOCK_MAIL',
      GSI1SK: `SENT_AT#${sentAt}#MAIL#${mailId}`,
    };

    await this.repository.save(item);
  }

  async sendOtpMail(mail: OtpMail): Promise<void> {
    const sentAt = new Date().toISOString();
    const mailId = randomUUID();
    const approvalLink = `${this.appBaseUrl}/approve?solicitud_id=${mail.requestId}&approver_token=${mail.approvalToken}`;

    const item: MockMailItem = {
      PK: `REQUEST#${mail.requestId}`,
      SK: `MAIL#${mail.approverId}#OTP`,
      entityType: 'MOCK_MAIL',
      mailType: 'OTP',
      mailId,
      requestId: mail.requestId,
      approverId: mail.approverId,
      to: mail.to,
      approverName: mail.approverName,
      role: mail.role,
      order: mail.order,
      subject: `Tu codigo de verificacion para la solicitud ${mail.requestId}`,
      approvalLink,
      otp: mail.otp,
      otpExpiresAt: mail.otpExpiresAt,
      sentAt,
      GSI1PK: 'MOCK_MAIL',
      GSI1SK: `SENT_AT#${sentAt}#MAIL#${mailId}`,
    };

    await this.repository.save(item);
  }
}
