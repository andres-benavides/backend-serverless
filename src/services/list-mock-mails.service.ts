import type { MockMailSummary } from '../domain/purchase-request';
import type { MockMailRepository } from '../repositories/mock-mail.repository';

export interface ListMockMailsInput {
  requestId?: string;
  limit: number;
}

export class ListMockMailsService {
  constructor(private readonly repository: MockMailRepository) {}

  async execute({
    requestId,
    limit,
  }: ListMockMailsInput): Promise<MockMailSummary[]> {
    const items = requestId
      ? await this.repository.findByRequest(requestId, limit)
      : await this.repository.findRecent(limit);

    return items
      .map(
        ({
          PK: _pk,
          SK: _sk,
          entityType: _entityType,
          GSI1PK: _gsi1pk,
          GSI1SK: _gsi1sk,
          ...mail
        }) => mail,
      )
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  }
}
