export type RequestStatus = 'PENDING' | 'REJECTED' | 'COMPLETED';
export type ApprovalStatus = 'PENDING' | 'SIGNED' | 'REJECTED';
export type ApprovalDecision = 'APPROVE' | 'REJECT';

export interface Requester {
  id: string;
  name: string;
  email: string;
}

export interface ApproverInput {
  role: string;
  name: string;
  email: string;
}

export interface CreateRequestBody {
  title: string;
  description: string;
  amount: number;
  requester: Requester;
  approvers: ApproverInput[];
}

export interface CreatedRequest {
  requestId: string;
  status: RequestStatus;
  createdAt: string;
}

export interface PurchaseRequestSummary {
  requestId: string;
  title: string;
  description: string;
  amount: number;
  requester: Requester;
  status: RequestStatus;
  currentApproverOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApproverSummary {
  approverId: string;
  order: number;
  role: string;
  name: string;
  email: string;
  status: ApprovalStatus;
  activatedAt?: string;
  signedAt?: string;
  rejectedAt?: string;
}

export interface PurchaseRequestDetail {
  request: PurchaseRequestSummary;
  approvers: ApproverSummary[];
}

export interface ApprovalView {
  status: ApprovalStatus;
  active: boolean;
  requiresOtp: boolean;
}

export interface PurchaseDetailForApprover {
  requestId: string;
  title: string;
  description: string;
  amount: number;
  createdAt: string;
  requester: Requester;
  approver: { name: string; role: string; order: number };
}

export interface EvidenceUrl {
  url: string;
  expiresInSeconds: number;
}

export interface DecisionResult {
  status: Extract<ApprovalStatus, 'SIGNED' | 'REJECTED'>;
  decidedAt: string;
}

export interface MockMail {
  mailId: string;
  mailType: 'APPROVAL_LINK' | 'OTP';
  requestId: string;
  approverId: string;
  to: string;
  approverName: string;
  role: string;
  order: number;
  subject: string;
  approvalLink: string;
  otp?: string;
  otpExpiresAt?: string;
  sentAt: string;
}
