import { ApiError } from './errors';
import type {
  ApprovalDecision,
  ApprovalView,
  CreateRequestBody,
  CreatedRequest,
  DecisionResult,
  EvidenceUrl,
  MockMail,
  PurchaseDetailForApprover,
  PurchaseRequestDetail,
  PurchaseRequestSummary,
} from './types';

interface ErrorBody {
  message?: string;
  attemptsLeft?: number;
}

const request = async <T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  const text = await response.text();
  const body = (text ? JSON.parse(text) : {}) as unknown;

  if (!response.ok) {
    const error = body as ErrorBody;

    throw new ApiError(
      response.status,
      error.message ?? 'Ha ocurrido un error inesperado',
      error.attemptsLeft,
    );
  }

  return body as T;
};

export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  createRequest(body: CreateRequestBody): Promise<CreatedRequest> {
    return request<CreatedRequest>(this.baseUrl, '/api/requests', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async listRequests(requesterId: string): Promise<PurchaseRequestSummary[]> {
    const { requests } = await request<{
      requests: PurchaseRequestSummary[];
    }>(
      this.baseUrl,
      `/api/requests?requesterId=${encodeURIComponent(requesterId)}`,
    );

    return requests;
  }

  getRequest(requestId: string): Promise<PurchaseRequestDetail> {
    return request<PurchaseRequestDetail>(
      this.baseUrl,
      `/api/requests/${encodeURIComponent(requestId)}`,
    );
  }

  async getEvidenceUrl(requestId: string): Promise<EvidenceUrl> {
    const { evidence } = await request<{ evidence: EvidenceUrl }>(
      this.baseUrl,
      `/api/requests/${encodeURIComponent(requestId)}/evidence`,
    );

    return evidence;
  }

  async getApproval(approvalToken: string): Promise<ApprovalView> {
    const { approval } = await request<{ approval: ApprovalView }>(
      this.baseUrl,
      `/api/approvals/${encodeURIComponent(approvalToken)}`,
    );

    return approval;
  }

  async requestOtp(approvalToken: string): Promise<{ expiresAt: string }> {
    const { otp } = await request<{ otp: { expiresAt: string } }>(
      this.baseUrl,
      `/api/approvals/${encodeURIComponent(approvalToken)}/otp`,
      { method: 'POST' },
    );

    return otp;
  }

  async verifyOtp(
    approvalToken: string,
    otp: string,
  ): Promise<PurchaseDetailForApprover> {
    const { purchase } = await request<{
      purchase: PurchaseDetailForApprover;
    }>(
      this.baseUrl,
      `/api/approvals/${encodeURIComponent(approvalToken)}/otp/verify`,
      { method: 'POST', body: JSON.stringify({ otp }) },
    );

    return purchase;
  }

  async submitDecision(
    approvalToken: string,
    decision: ApprovalDecision,
  ): Promise<DecisionResult> {
    const { approval } = await request<{ approval: DecisionResult }>(
      this.baseUrl,
      `/api/approvals/${encodeURIComponent(approvalToken)}/decision`,
      { method: 'POST', body: JSON.stringify({ decision }) },
    );

    return approval;
  }

  async listMockMails(limit = 30): Promise<MockMail[]> {
    const { mails } = await request<{ mails: MockMail[] }>(
      this.baseUrl,
      `/mock-mail?limit=${String(limit)}`,
    );

    return mails;
  }
}
