import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type {
  ApproverItem,
  PurchaseRequestItem,
} from '../domain/purchase-request';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const INK = rgb(0.11, 0.13, 0.16);
const MUTED = rgb(0.42, 0.45, 0.5);
const RULE = rgb(0.85, 0.87, 0.9);

const formatAmount = (amount: number): string =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);

const formatDate = (iso: string): string =>
  `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`;

const outcomeLabel = (approvers: ApproverItem[]): string => {
  if (approvers.some((approver) => approver.status === 'REJECTED')) {
    return 'Rechazada';
  }

  if (
    approvers.length > 0 &&
    approvers.every((approver) => approver.status === 'SIGNED')
  ) {
    return 'Aprobada por los tres aprobadores';
  }

  return 'En proceso';
};

const statusLabel = (approver: ApproverItem): string => {
  if (approver.status === 'SIGNED') return 'Firmado';
  if (approver.status === 'REJECTED') return 'Rechazado';
  return 'Pendiente';
};

const signatureDate = (approver: ApproverItem): string => {
  const date = approver.signedAt ?? approver.rejectedAt;

  return date ? formatDate(date) : '-';
};

export const buildEvidencePdf = async (
  request: PurchaseRequestItem,
  approvers: ApproverItem[],
  generatedAt: string,
): Promise<Uint8Array> => {
  const document = await PDFDocument.create();
  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  document.setTitle(`Evidencia de aprobacion ${request.requestId}`);
  document.setSubject('Evidencia de firmas concatenadas');

  let y = PAGE_HEIGHT - MARGIN;

  const text = (
    value: string,
    size: number,
    font = regular,
    color = INK,
  ): void => {
    page.drawText(value, { x: MARGIN, y, size, font, color });
  };

  const rule = (): void => {
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.75,
      color: RULE,
    });
  };

  text('Evidencia de aprobacion', 20, bold);
  y -= 18;
  text(`Solicitud ${request.requestId}`, 10, regular, MUTED);
  y -= 16;
  rule();
  y -= 26;

  text('Datos de la solicitud', 13, bold);
  y -= 20;

  const fields: [string, string][] = [
    ['Titulo', request.title],
    ['Descripcion', request.description],
    ['Monto', formatAmount(request.amount)],
    ['Fecha de creacion', formatDate(request.createdAt)],
    ['Solicitante', `${request.requester.name} (${request.requester.email})`],
    ['Resultado', outcomeLabel(approvers)],
  ];

  for (const [label, value] of fields) {
    page.drawText(label, {
      x: MARGIN,
      y,
      size: 9,
      font: bold,
      color: MUTED,
    });
    page.drawText(value.slice(0, 78), {
      x: MARGIN + 130,
      y,
      size: 10,
      font: regular,
      color: INK,
    });
    y -= 18;
  }

  y -= 12;
  rule();
  y -= 26;

  text('Aprobadores y firmas', 13, bold);
  y -= 22;

  const columns = [
    MARGIN,
    MARGIN + 30,
    MARGIN + 180,
    MARGIN + 300,
    MARGIN + 380,
  ];
  const headers = ['#', 'Nombre', 'Rol', 'Estado', 'Fecha de firma'];

  headers.forEach((header, index) => {
    page.drawText(header, {
      x: columns[index],
      y,
      size: 9,
      font: bold,
      color: MUTED,
    });
  });

  y -= 6;
  rule();
  y -= 16;

  for (const approver of [...approvers].sort((a, b) => a.order - b.order)) {
    const cells = [
      String(approver.order),
      approver.name.slice(0, 24),
      approver.role.slice(0, 18),
      statusLabel(approver),
      signatureDate(approver),
    ];

    cells.forEach((cell, index) => {
      page.drawText(cell, {
        x: columns[index],
        y,
        size: 9,
        font: regular,
        color: INK,
      });
    });

    y -= 20;
  }

  y -= 10;
  rule();
  y -= 20;

  page.drawText(`Documento generado el ${formatDate(generatedAt)}`, {
    x: MARGIN,
    y,
    size: 8,
    font: regular,
    color: MUTED,
  });

  return document.save();
};
