export type RequestStatus = 'PENDING' | 'REJECTED' | 'COMPLETED';
export type ApprovalStatus = 'PENDING' | 'SIGNED' | 'REJECTED';

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

export interface CreatePurchaseRequestInput {
  title: string;
  description: string;
  amount: number;
  requester: Requester;
  approvers: ApproverInput[];
}

export interface PurchaseRequestItem {
  PK: string;
  SK: 'METADATA';
  entityType: 'PURCHASE_REQUEST';
  requestId: string;
  title: string;
  description: string;
  amount: number;
  requester: Requester;
  status: RequestStatus;
  currentApproverOrder: number;
  executionArn?: string;
  createdAt: string;
  updatedAt: string;
  GSI1PK: string;
  GSI1SK: string;
}

export type PurchaseRequestSummary = Omit<
  PurchaseRequestItem,
  'PK' | 'SK' | 'entityType' | 'executionArn' | 'GSI1PK' | 'GSI1SK'
>;

export interface ApproverItem {
  PK: string;
  SK: string;
  entityType: 'APPROVER';
  requestId: string;
  approverId: string;
  order: number;
  role: string;
  name: string;
  email: string;
  status: ApprovalStatus;
  approvalToken: string;
  taskToken?: string;
  activatedAt?: string;
  createdAt: string;
  updatedAt: string;
  GSI2PK: string;
  GSI2SK: string;
}

export interface ApprovalView {
  status: ApprovalStatus;
  active: boolean;
  requiresOtp: boolean;
}

export type ApproverSummary = Omit<
  ApproverItem,
  | 'PK'
  | 'SK'
  | 'entityType'
  | 'approvalToken'
  | 'taskToken'
  | 'GSI2PK'
  | 'GSI2SK'
>;

export interface PurchaseRequestDetail {
  request: PurchaseRequestSummary;
  approvers: ApproverSummary[];
}

export interface MockMailItem {
  PK: string;
  SK: string;
  entityType: 'MOCK_MAIL';
  mailId: string;
  requestId: string;
  approverId: string;
  to: string;
  approverName: string;
  role: string;
  order: number;
  subject: string;
  approvalLink: string;
  sentAt: string;
  GSI1PK: string;
  GSI1SK: string;
}

export type MockMailSummary = Omit<
  MockMailItem,
  'PK' | 'SK' | 'entityType' | 'GSI1PK' | 'GSI1SK'
>;
