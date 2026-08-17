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
  createdAt: string;
  updatedAt: string;
  GSI1PK: string;
  GSI1SK: string;
}

export type PurchaseRequestSummary = Omit<
  PurchaseRequestItem,
  'PK' | 'SK' | 'entityType' | 'GSI1PK' | 'GSI1SK'
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
  'PK' | 'SK' | 'entityType' | 'approvalToken' | 'GSI2PK' | 'GSI2SK'
>;

export interface PurchaseRequestDetail {
  request: PurchaseRequestSummary;
  approvers: ApproverSummary[];
}
