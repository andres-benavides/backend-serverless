import { describe, expect, it, vi } from 'vitest';
import type { MockMailItem } from '../../src/domain/purchase-request';
import { MockMailSender } from '../../src/infrastructure/mail-sender';
import type { MockMailRepository } from '../../src/repositories/mock-mail.repository';

const mail = {
  requestId: 'req-1',
  approverId: 'approver-1',
  to: 'one@example.com',
  approverName: 'Approver One',
  role: 'Manager',
  order: 1,
  approvalToken: 'token-1',
};

const build = () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const sender = new MockMailSender(
    { save } as unknown as MockMailRepository,
    'https://app.example.com',
  );

  return { save, sender };
};

const savedItem = (save: ReturnType<typeof vi.fn>) =>
  save.mock.calls[0][0] as MockMailItem;

describe('MockMailSender', () => {
  it('builds the approval link with the public token', async () => {
    const { save, sender } = build();

    await sender.sendApprovalMail(mail);

    expect(savedItem(save).approvalLink).toBe(
      'https://app.example.com/approve?solicitud_id=req-1&approver_token=token-1',
    );
  });

  it('addresses the mail to the approver', async () => {
    const { save, sender } = build();

    await sender.sendApprovalMail(mail);
    const item = savedItem(save);

    expect(item.to).toBe('one@example.com');
    expect(item.approverName).toBe('Approver One');
    expect(item.role).toBe('Manager');
    expect(item.order).toBe(1);
  });

  it('stores one mail item per approver under the request partition', async () => {
    const { save, sender } = build();

    await sender.sendApprovalMail(mail);
    const item = savedItem(save);

    expect(item.PK).toBe('REQUEST#req-1');
    expect(item.SK).toBe('MAIL#approver-1');
    expect(item.entityType).toBe('MOCK_MAIL');
  });

  it('indexes the mail for the global inbox listing', async () => {
    const { save, sender } = build();

    await sender.sendApprovalMail(mail);
    const item = savedItem(save);

    expect(item.GSI1PK).toBe('MOCK_MAIL');
    expect(item.GSI1SK).toContain('SENT_AT#');
    expect(item.GSI1SK).toContain(`MAIL#${item.mailId}`);
  });

  it('propagates persistence failures', async () => {
    const save = vi.fn().mockRejectedValue(new Error('dynamo down'));
    const sender = new MockMailSender(
      { save } as unknown as MockMailRepository,
      'https://app.example.com',
    );

    await expect(sender.sendApprovalMail(mail)).rejects.toThrow('dynamo down');
  });
});
