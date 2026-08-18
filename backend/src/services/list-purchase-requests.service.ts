import type { PurchaseRequestSummary } from '../domain/purchase-request';
import type { PurchaseRequestRepository } from '../repositories/purchase-request.repository';

export class ListPurchaseRequestsService {
  constructor(private readonly repository: PurchaseRequestRepository) {}

  async execute(requesterId: string): Promise<PurchaseRequestSummary[]> {
    const items = await this.repository.findByRequester(requesterId);

    return items.map(
      ({
        PK: _pk,
        SK: _sk,
        entityType: _entityType,
        executionArn: _executionArn,
        GSI1PK: _gsi1pk,
        GSI1SK: _gsi1sk,
        ...request
      }) => request,
    );
  }
}
