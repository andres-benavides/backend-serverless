import { MockMailSender } from '../infrastructure/mail-sender';
import { MockMailRepository } from '../repositories/mock-mail.repository';
import { PurchaseRequestRepository } from '../repositories/purchase-request.repository';
import { ActivateApproverService } from '../services/activate-approver.service';
import type { ActivateApproverInput } from '../services/activate-approver.service';

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error('TABLE_NAME is required');

const appBaseUrl = process.env.APP_BASE_URL ?? 'https://dominio.com';

const repository = new PurchaseRequestRepository(tableName);
const mailSender = new MockMailSender(
  new MockMailRepository(tableName),
  appBaseUrl,
);
const service = new ActivateApproverService(repository, mailSender);

export const handler = async (event: ActivateApproverInput): Promise<void> => {
  console.log(
    JSON.stringify({
      operation: 'activate-approver',
      requestId: event.requestId,
      order: event.order,
    }),
  );

  await service.execute(event);
};
