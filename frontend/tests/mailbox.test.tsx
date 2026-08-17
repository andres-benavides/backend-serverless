import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MailboxApp } from '../apps/approver/src/MailboxApp';
import { jsonResponse, mockFetch, renderAt } from './helpers';

let fetchMock: ReturnType<typeof mockFetch>;

const mail = (overrides = {}) => ({
  mailId: 'mail-1',
  mailType: 'APPROVAL_LINK',
  requestId: 'req-1',
  approverId: 'approver-1',
  to: 'ana@example.com',
  approverName: 'Ana Gomez',
  role: 'Manager',
  order: 1,
  subject: 'Aprobacion pendiente de la solicitud req-1',
  approvalLink:
    'https://dominio.com/approve?solicitud_id=req-1&approver_token=tok-1',
  sentAt: '2026-08-17T02:00:00.000Z',
  ...overrides,
});

describe('MailboxApp', () => {
  beforeEach(() => {
    fetchMock = mockFetch();
  });

  it('warns that it replaces real email', async () => {
    fetchMock.mockReturnValue(jsonResponse(200, { mails: [] }));

    renderAt(<MailboxApp />);

    expect(
      await screen.findByText('Bandeja de demostracion'),
    ).toBeInTheDocument();
  });

  it('shows a skeleton while loading', () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));

    renderAt(<MailboxApp />);

    expect(screen.getByTestId('mailbox-loading')).toBeInTheDocument();
  });

  it('rewrites the mail link to the local origin', async () => {
    fetchMock.mockReturnValue(jsonResponse(200, { mails: [mail()] }));

    renderAt(<MailboxApp />);

    const link = await screen.findByRole('link', { name: 'Abrir aprobacion' });

    expect(link).toHaveAttribute(
      'href',
      '/approve?solicitud_id=req-1&approver_token=tok-1',
    );
  });

  it('shows the otp only on code mails', async () => {
    fetchMock.mockReturnValue(
      jsonResponse(200, {
        mails: [
          mail(),
          mail({
            mailId: 'mail-2',
            mailType: 'OTP',
            otp: '123456',
            otpExpiresAt: '2026-08-17T02:03:00.000Z',
          }),
        ],
      }),
    );

    renderAt(<MailboxApp />);

    expect(await screen.findByText('123456')).toBeInTheDocument();
    expect(screen.getByText('Codigo')).toBeInTheDocument();
    expect(screen.getByText('Invitacion')).toBeInTheDocument();
  });

  it('explains the empty inbox', async () => {
    fetchMock.mockReturnValue(jsonResponse(200, { mails: [] }));

    renderAt(<MailboxApp />);

    expect(await screen.findByText(/El buzon esta vacio/)).toBeInTheDocument();
  });

  it('surfaces a failure reading the inbox', async () => {
    fetchMock.mockReturnValue(jsonResponse(500, { message: 'boom' }));

    renderAt(<MailboxApp />);

    expect(
      await screen.findByText('No se pudo leer el buzon'),
    ).toBeInTheDocument();
  });

  it('reloads on demand', async () => {
    const user = userEvent.setup();
    fetchMock.mockReturnValue(jsonResponse(200, { mails: [] }));

    renderAt(<MailboxApp />);

    await user.click(await screen.findByRole('button', { name: 'Actualizar' }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
