import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ApproverItem,
  PurchaseRequestItem,
} from '../../src/domain/purchase-request';
import type { EvidenceStorage } from '../../src/infrastructure/evidence-storage';
import type { PurchaseRequestRepository } from '../../src/repositories/purchase-request.repository';
import { GenerateEvidenceService } from '../../src/services/generate-evidence.service';
import {
  EVIDENCE_URL_TTL_SECONDS,
  GetEvidenceUrlService,
} from '../../src/services/get-evidence-url.service';
import { ConflictError, NotFoundError } from '../../src/shared/errors';

const requestId = 'req-1';
const now = new Date('2026-08-17T10:00:00.000Z');

const request: PurchaseRequestItem = {
  PK: `REQUEST#${requestId}`,
  SK: 'METADATA',
  entityType: 'PURCHASE_REQUEST',
  requestId,
  title: 'Compra de portatiles',
  description: 'Tres equipos',
  amount: 15000000,
  requester: { id: 'user-001', name: 'Demo', email: 'demo@example.com' },
  status: 'PENDING',
  currentApproverOrder: 3,
  createdAt: '2026-08-17T09:00:00.000Z',
  updatedAt: '2026-08-17T09:00:00.000Z',
  GSI1PK: 'REQUESTER#user-001',
  GSI1SK: 'CREATED_AT#2026-08-17T09:00:00.000Z#REQUEST#req-1',
};

const approver: ApproverItem = {
  PK: `REQUEST#${requestId}`,
  SK: 'APPROVER#01#approver-1',
  entityType: 'APPROVER',
  requestId,
  approverId: 'approver-1',
  order: 1,
  role: 'Manager',
  name: 'Approver One',
  email: 'one@example.com',
  status: 'SIGNED',
  approvalToken: 'token-1',
  signedAt: '2026-08-17T09:30:00.000Z',
  createdAt: '2026-08-17T09:00:00.000Z',
  updatedAt: '2026-08-17T09:30:00.000Z',
  GSI2PK: 'APPROVAL_TOKEN#token-1',
  GSI2SK: `REQUEST#${requestId}#APPROVER#approver-1`,
};

describe('GenerateEvidenceService', () => {
  let repository: {
    findById: ReturnType<typeof vi.fn>;
    saveEvidenceKey: ReturnType<typeof vi.fn>;
  };
  let storage: { put: ReturnType<typeof vi.fn> };
  let service: GenerateEvidenceService;

  beforeEach(() => {
    repository = {
      findById: vi.fn().mockResolvedValue([request, approver]),
      saveEvidenceKey: vi.fn().mockResolvedValue(undefined),
    };
    storage = { put: vi.fn().mockResolvedValue(undefined) };
    service = new GenerateEvidenceService(
      repository as unknown as PurchaseRequestRepository,
      storage as unknown as EvidenceStorage,
    );
  });

  it('stores the pdf under the request prefix', async () => {
    const result = await service.execute(requestId, now);

    expect(result.evidenceKey).toBe('requests/req-1/evidence.pdf');
    expect(storage.put).toHaveBeenCalledWith(
      'requests/req-1/evidence.pdf',
      expect.anything(),
    );
  });

  it('uploads real pdf bytes', async () => {
    await service.execute(requestId, now);

    const body = storage.put.mock.calls[0][1] as Uint8Array;

    expect(Buffer.from(body.slice(0, 5)).toString()).toBe('%PDF-');
  });

  it('records the key in dynamodb after uploading', async () => {
    const order: string[] = [];
    storage.put.mockImplementation(() => {
      order.push('s3');
      return Promise.resolve();
    });
    repository.saveEvidenceKey.mockImplementation(() => {
      order.push('dynamodb');
      return Promise.resolve();
    });

    await service.execute(requestId, now);

    expect(order).toEqual(['s3', 'dynamodb']);
    expect(repository.saveEvidenceKey).toHaveBeenCalledWith(
      requestId,
      'requests/req-1/evidence.pdf',
      now.toISOString(),
    );
  });

  it('does not record the key when the upload fails', async () => {
    storage.put.mockRejectedValue(new Error('s3 down'));

    await expect(service.execute(requestId, now)).rejects.toThrow('s3 down');
    expect(repository.saveEvidenceKey).not.toHaveBeenCalled();
  });

  it('fails when the request does not exist', async () => {
    repository.findById.mockResolvedValue([]);

    await expect(service.execute(requestId, now)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('GetEvidenceUrlService', () => {
  let repository: { findRequestMetadata: ReturnType<typeof vi.fn> };
  let storage: { presignedUrl: ReturnType<typeof vi.fn> };
  let service: GetEvidenceUrlService;

  beforeEach(() => {
    repository = {
      findRequestMetadata: vi.fn().mockResolvedValue({
        ...request,
        status: 'COMPLETED',
        evidenceKey: 'requests/req-1/evidence.pdf',
      }),
    };
    storage = {
      presignedUrl: vi.fn().mockResolvedValue('https://s3.example/signed'),
    };
    service = new GetEvidenceUrlService(
      repository as unknown as PurchaseRequestRepository,
      storage as unknown as EvidenceStorage,
    );
  });

  it('returns a short lived presigned url', async () => {
    const result = await service.execute(requestId);

    expect(result.url).toBe('https://s3.example/signed');
    expect(result.expiresInSeconds).toBe(EVIDENCE_URL_TTL_SECONDS);
    expect(storage.presignedUrl).toHaveBeenCalledWith(
      'requests/req-1/evidence.pdf',
      EVIDENCE_URL_TTL_SECONDS,
    );
  });

  it('never exposes the bucket key itself', async () => {
    const result = await service.execute(requestId);

    expect(Object.keys(result).sort()).toEqual(['expiresInSeconds', 'url']);
  });

  it('fails while the evidence has not been generated', async () => {
    repository.findRequestMetadata.mockResolvedValue(request);

    await expect(service.execute(requestId)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(storage.presignedUrl).not.toHaveBeenCalled();
  });

  it('fails when the request does not exist', async () => {
    repository.findRequestMetadata.mockResolvedValue(undefined);

    await expect(service.execute(requestId)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
