import type { EvidenceStorage } from '../infrastructure/evidence-storage';
import type { PurchaseRequestRepository } from '../repositories/purchase-request.repository';
import { ConflictError, NotFoundError } from '../shared/errors';

export const EVIDENCE_URL_TTL_SECONDS = 300;

export interface EvidenceUrl {
  url: string;
  expiresInSeconds: number;
}

export class GetEvidenceUrlService {
  constructor(
    private readonly repository: PurchaseRequestRepository,
    private readonly storage: EvidenceStorage,
  ) {}

  async execute(requestId: string): Promise<EvidenceUrl> {
    const request = await this.repository.findRequestMetadata(requestId);

    if (!request) {
      throw new NotFoundError('Purchase request not found');
    }

    if (!request.evidenceKey) {
      throw new ConflictError(
        'The evidence is not available until the three approvers sign',
      );
    }

    const url = await this.storage.presignedUrl(
      request.evidenceKey,
      EVIDENCE_URL_TTL_SECONDS,
    );

    return { url, expiresInSeconds: EVIDENCE_URL_TTL_SECONDS };
  }
}
