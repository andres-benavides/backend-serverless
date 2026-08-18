import type {
  ApproverItem,
  PurchaseRequestItem,
} from '../domain/purchase-request';
import type { EvidenceStorage } from '../infrastructure/evidence-storage';
import { evidenceKeyFor } from '../infrastructure/evidence-storage';
import type { PurchaseRequestRepository } from '../repositories/purchase-request.repository';
import { NotFoundError } from '../shared/errors';
import { buildEvidencePdf } from '../shared/evidence-pdf';

export interface GenerateEvidenceResult {
  evidenceKey: string;
  generatedAt: string;
}

export class GenerateEvidenceService {
  constructor(
    private readonly repository: PurchaseRequestRepository,
    private readonly storage: EvidenceStorage,
  ) {}

  async execute(
    requestId: string,
    now = new Date(),
  ): Promise<GenerateEvidenceResult> {
    const items = await this.repository.findById(requestId);

    const request = items.find(
      (item): item is PurchaseRequestItem =>
        item.entityType === 'PURCHASE_REQUEST',
    );

    if (!request) {
      throw new NotFoundError('Purchase request not found');
    }

    const approvers = items.filter(
      (item): item is ApproverItem => item.entityType === 'APPROVER',
    );

    const generatedAt = now.toISOString();
    const pdf = await buildEvidencePdf(request, approvers, generatedAt);
    const evidenceKey = evidenceKeyFor(requestId);

    await this.storage.put(evidenceKey, pdf);
    await this.repository.saveEvidenceKey(requestId, evidenceKey, generatedAt);

    return { evidenceKey, generatedAt };
  }
}
