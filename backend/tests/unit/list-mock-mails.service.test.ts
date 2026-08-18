import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockMailItem } from '../../src/domain/purchase-request';
import type { MockMailRepository } from '../../src/repositories/mock-mail.repository';
import { ListMockMailsService } from '../../src/services/list-mock-mails.service';

const mailItem = (approverId: string, sentAt: string): MockMailItem => ({
  PK: 'REQUEST#req-1',
  SK: `MAIL#${approverId}`,
  entityType: 'MOCK_MAIL',
  mailType: 'APPROVAL_LINK',
  mailId: `mail-${approverId}`,
  requestId: 'req-1',
  approverId,
  to: `${approverId}@example.com`,
  approverName: 'Approver',
  role: 'Manager',
  order: 1,
  subject: 'Aprobacion pendiente',
  approvalLink: 'https://app.example.com/approve?solicitud_id=req-1',
  sentAt,
  GSI1PK: 'MOCK_MAIL',
  GSI1SK: `SENT_AT#${sentAt}#MAIL#mail-${approverId}`,
});

describe('ListMockMailsService', () => {
  let repository: {
    findRecent: ReturnType<typeof vi.fn>;
    findByRequest: ReturnType<typeof vi.fn>;
  };
  let service: ListMockMailsService;

  beforeEach(() => {
    repository = {
      findRecent: vi.fn().mockResolvedValue([]),
      findByRequest: vi.fn().mockResolvedValue([]),
    };
    service = new ListMockMailsService(
      repository as unknown as MockMailRepository,
    );
  });

  it('lists the global inbox when no request is given', async () => {
    await service.execute({ limit: 10 });

    expect(repository.findRecent).toHaveBeenCalledWith(10);
    expect(repository.findByRequest).not.toHaveBeenCalled();
  });

  it('filters by request when one is given', async () => {
    await service.execute({ requestId: 'req-1', limit: 10 });

    expect(repository.findByRequest).toHaveBeenCalledWith('req-1', 10);
    expect(repository.findRecent).not.toHaveBeenCalled();
  });

  it('returns the newest mail first', async () => {
    repository.findRecent.mockResolvedValue([
      mailItem('a', '2026-08-16T20:00:00.000Z'),
      mailItem('c', '2026-08-16T22:00:00.000Z'),
      mailItem('b', '2026-08-16T21:00:00.000Z'),
    ]);

    const mails = await service.execute({ limit: 10 });

    expect(mails.map((m) => m.approverId)).toEqual(['c', 'b', 'a']);
  });

  it('strips the single table keys', async () => {
    repository.findRecent.mockResolvedValue([
      mailItem('a', '2026-08-16T20:00:00.000Z'),
    ]);

    const [mail] = await service.execute({ limit: 10 });

    expect(mail).not.toHaveProperty('PK');
    expect(mail).not.toHaveProperty('SK');
    expect(mail).not.toHaveProperty('entityType');
    expect(mail).not.toHaveProperty('GSI1PK');
    expect(mail).not.toHaveProperty('GSI1SK');
  });

  it('keeps the approval link, which is the point of the mock inbox', async () => {
    repository.findRecent.mockResolvedValue([
      mailItem('a', '2026-08-16T20:00:00.000Z'),
    ]);

    const [mail] = await service.execute({ limit: 10 });

    expect(mail.approvalLink).toContain('/approve?solicitud_id=req-1');
  });
});
