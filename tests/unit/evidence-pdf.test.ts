import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type {
  ApproverItem,
  PurchaseRequestItem,
} from '../../src/domain/purchase-request';
import { buildEvidencePdf } from '../../src/shared/evidence-pdf';

const requestId = 'req-1';

const request: PurchaseRequestItem = {
  PK: `REQUEST#${requestId}`,
  SK: 'METADATA',
  entityType: 'PURCHASE_REQUEST',
  requestId,
  title: 'Compra de portatiles',
  description: 'Tres equipos para el equipo de desarrollo',
  amount: 15000000,
  requester: {
    id: 'user-001',
    name: 'Solicitante Demo',
    email: 'requester@example.com',
  },
  status: 'COMPLETED',
  currentApproverOrder: 3,
  createdAt: '2026-08-17T09:00:00.000Z',
  updatedAt: '2026-08-17T10:00:00.000Z',
  GSI1PK: 'REQUESTER#user-001',
  GSI1SK: 'CREATED_AT#2026-08-17T09:00:00.000Z#REQUEST#req-1',
};

const approver = (order: number, name: string, role: string): ApproverItem => ({
  PK: `REQUEST#${requestId}`,
  SK: `APPROVER#0${String(order)}#approver-${String(order)}`,
  entityType: 'APPROVER',
  requestId,
  approverId: `approver-${String(order)}`,
  order,
  role,
  name,
  email: `approver${String(order)}@example.com`,
  status: 'SIGNED',
  approvalToken: `token-${String(order)}`,
  taskToken: `task-token-${String(order)}`,
  signedAt: `2026-08-17T09:3${String(order)}:00.000Z`,
  createdAt: '2026-08-17T09:00:00.000Z',
  updatedAt: '2026-08-17T09:30:00.000Z',
  GSI2PK: `APPROVAL_TOKEN#token-${String(order)}`,
  GSI2SK: `REQUEST#${requestId}#APPROVER#approver-${String(order)}`,
});

const approvers = [
  approver(3, 'Approver Three', 'Director'),
  approver(1, 'Approver One', 'Manager'),
  approver(2, 'Approver Two', 'Finance'),
];

const generatedAt = '2026-08-17T10:00:00.000Z';

describe('buildEvidencePdf', () => {
  it('produces a valid single page pdf', async () => {
    const bytes = await buildEvidencePdf(request, approvers, generatedAt);

    const parsed = await PDFDocument.load(bytes);

    expect(parsed.getPageCount()).toBe(1);
    expect(bytes.length).toBeGreaterThan(500);
  });

  it('starts with the pdf magic number', async () => {
    const bytes = await buildEvidencePdf(request, approvers, generatedAt);

    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
  });

  it('titles the document with the request id', async () => {
    const bytes = await buildEvidencePdf(request, approvers, generatedAt);

    const parsed = await PDFDocument.load(bytes);

    expect(parsed.getTitle()).toContain(requestId);
  });

  it('never embeds internal tokens', async () => {
    const bytes = await buildEvidencePdf(request, approvers, generatedAt);
    const raw = Buffer.from(bytes).toString('latin1');

    expect(raw).not.toContain('task-token-1');
    expect(raw).not.toContain('token-1');
  });

  it('renders without throwing when an approver rejected', async () => {
    const rejected: ApproverItem = {
      ...approver(2, 'Approver Two', 'Finance'),
      status: 'REJECTED',
      signedAt: undefined,
      rejectedAt: '2026-08-17T09:32:00.000Z',
    };

    const bytes = await buildEvidencePdf(request, [rejected], generatedAt);

    expect(bytes.length).toBeGreaterThan(500);
  });

  it('renders without throwing when an approver is still pending', async () => {
    const pending: ApproverItem = {
      ...approver(2, 'Approver Two', 'Finance'),
      status: 'PENDING',
      signedAt: undefined,
    };

    const bytes = await buildEvidencePdf(request, [pending], generatedAt);

    expect(bytes.length).toBeGreaterThan(500);
  });

  it('tolerates long titles and descriptions without overflowing', async () => {
    const long: PurchaseRequestItem = {
      ...request,
      title: 'T'.repeat(400),
      description: 'D'.repeat(900),
    };

    const bytes = await buildEvidencePdf(long, approvers, generatedAt);
    const parsed = await PDFDocument.load(bytes);

    expect(parsed.getPageCount()).toBe(1);
  });
});
