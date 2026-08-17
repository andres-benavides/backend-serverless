import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApproverApp } from '../apps/approver/src/ApproverApp';
import { ApprovalDetailView } from '../apps/approver/src/views/ApprovalDetailView';
import { OtpGateView } from '../apps/approver/src/views/OtpGateView';
import { jsonResponse, mockFetch, renderAt } from './helpers';

let fetchMock: ReturnType<typeof mockFetch>;

const token = 'a3b1f4c2-1111-4222-8333-444455556666';

const purchase = {
  requestId: 'req-1',
  title: 'Compra de portatiles',
  description: 'Tres equipos',
  amount: 15000000,
  createdAt: '2026-08-17T09:00:00.000Z',
  requester: { id: 'user-001', name: 'Solicitante Demo', email: 'd@e.com' },
  approver: { name: 'Approver One', role: 'Manager', order: 1 },
};

const approvalView = (overrides = {}) => ({
  approval: {
    status: 'PENDING',
    active: true,
    requiresOtp: true,
    ...overrides,
  },
});

describe('ApproverApp', () => {
  beforeEach(() => {
    fetchMock = mockFetch();
  });

  it('rejects a link without the token', () => {
    renderAt(<ApproverApp />, '/approve');

    expect(screen.getByText('Enlace invalido')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('opens the otp gate when the link carries a token', async () => {
    fetchMock.mockReturnValue(jsonResponse(200, approvalView()));

    renderAt(
      <ApproverApp />,
      `/approve?solicitud_id=req-1&approver_token=${token}`,
    );

    expect(
      await screen.findByText('Verificacion en dos pasos'),
    ).toBeInTheDocument();
  });
});

describe('OtpGateView', () => {
  beforeEach(() => {
    fetchMock = mockFetch();
  });

  const render = () =>
    renderAt(<OtpGateView approvalToken={token} onVerified={vi.fn()} />);

  it('shows a skeleton while loading the approval', () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));

    render();

    expect(screen.getByTestId('approval-loading')).toBeInTheDocument();
  });

  it('explains that it is not this approver turn yet', async () => {
    fetchMock.mockReturnValue(
      jsonResponse(200, approvalView({ active: false, requiresOtp: false })),
    );

    render();

    expect(
      await screen.findByText(/Todavia no es tu turno/),
    ).toBeInTheDocument();
  });

  it('explains that the approval was already processed', async () => {
    fetchMock.mockReturnValue(
      jsonResponse(
        200,
        approvalView({ status: 'SIGNED', active: false, requiresOtp: false }),
      ),
    );

    render();

    expect(
      await screen.findByText('Esta aprobacion ya fue procesada.'),
    ).toBeInTheDocument();
  });

  it('does not show the code field before requesting it', async () => {
    fetchMock.mockReturnValue(jsonResponse(200, approvalView()));

    render();

    expect(
      await screen.findByRole('button', { name: 'Enviar codigo' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Codigo')).not.toBeInTheDocument();
  });

  it('reveals the code field after requesting the otp', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockReturnValueOnce(jsonResponse(200, approvalView()))
      .mockReturnValueOnce(
        jsonResponse(201, { otp: { expiresAt: '2026-08-17T10:03:00.000Z' } }),
      );

    render();

    await user.click(
      await screen.findByRole('button', { name: 'Enviar codigo' }),
    );

    expect(await screen.findByLabelText('Codigo')).toBeInTheDocument();
  });

  it('keeps the verify button disabled until six digits are typed', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockReturnValueOnce(jsonResponse(200, approvalView()))
      .mockReturnValueOnce(
        jsonResponse(201, { otp: { expiresAt: '2026-08-17T10:03:00.000Z' } }),
      );

    render();

    await user.click(
      await screen.findByRole('button', { name: 'Enviar codigo' }),
    );
    await user.type(await screen.findByLabelText('Codigo'), '123');

    expect(screen.getByRole('button', { name: 'Verificar' })).toBeDisabled();

    await user.type(screen.getByLabelText('Codigo'), '456');

    expect(screen.getByRole('button', { name: 'Verificar' })).toBeEnabled();
  });

  it('hands the purchase detail over when the code is right', async () => {
    const user = userEvent.setup();
    const onVerified = vi.fn();
    fetchMock
      .mockReturnValueOnce(jsonResponse(200, approvalView()))
      .mockReturnValueOnce(
        jsonResponse(201, { otp: { expiresAt: '2026-08-17T10:03:00.000Z' } }),
      )
      .mockReturnValueOnce(jsonResponse(200, { purchase }));

    renderAt(<OtpGateView approvalToken={token} onVerified={onVerified} />);

    await user.click(
      await screen.findByRole('button', { name: 'Enviar codigo' }),
    );
    await user.type(await screen.findByLabelText('Codigo'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verificar' }));

    await waitFor(() => {
      expect(onVerified).toHaveBeenCalledWith(purchase);
    });
  });

  it('shows the remaining attempts when the code is wrong', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockReturnValueOnce(jsonResponse(200, approvalView()))
      .mockReturnValueOnce(
        jsonResponse(201, { otp: { expiresAt: '2026-08-17T10:03:00.000Z' } }),
      )
      .mockReturnValueOnce(
        jsonResponse(401, { message: 'Invalid OTP', attemptsLeft: 3 }),
      );

    render();

    await user.click(
      await screen.findByRole('button', { name: 'Enviar codigo' }),
    );
    await user.type(await screen.findByLabelText('Codigo'), '000000');
    await user.click(screen.getByRole('button', { name: 'Verificar' }));

    expect(await screen.findByText('Invalid OTP')).toBeInTheDocument();
    expect(screen.getByText('Te quedan 3 intentos.')).toBeInTheDocument();
  });

  it('surfaces a failure loading the approval', async () => {
    fetchMock.mockReturnValue(
      jsonResponse(404, { message: 'Approval not found' }),
    );

    render();

    expect(
      await screen.findByText('No se pudo abrir la aprobacion'),
    ).toBeInTheDocument();
  });
});

describe('ApprovalDetailView', () => {
  beforeEach(() => {
    fetchMock = mockFetch();
  });

  const render = () =>
    renderAt(<ApprovalDetailView approvalToken={token} purchase={purchase} />);

  it('shows the purchase detail once the otp passed', () => {
    render();

    expect(screen.getByText('Compra de portatiles')).toBeInTheDocument();
    expect(screen.getByText('Solicitante Demo')).toBeInTheDocument();
    expect(screen.getByText(/Aprobador 1/)).toBeInTheDocument();
  });

  it('registers an approval', async () => {
    const user = userEvent.setup();
    fetchMock.mockReturnValue(
      jsonResponse(200, {
        approval: { status: 'SIGNED', decidedAt: '2026-08-17T10:00:00.000Z' },
      }),
    );

    render();

    await user.click(screen.getByRole('button', { name: 'Aprobar' }));

    expect(
      await screen.findByText('Firmaste la solicitud'),
    ).toBeInTheDocument();

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    ) as { decision: string };
    expect(body.decision).toBe('APPROVE');
  });

  it('registers a rejection', async () => {
    const user = userEvent.setup();
    fetchMock.mockReturnValue(
      jsonResponse(200, {
        approval: { status: 'REJECTED', decidedAt: '2026-08-17T10:00:00.000Z' },
      }),
    );

    render();

    await user.click(screen.getByRole('button', { name: 'Rechazar' }));

    expect(
      await screen.findByText('Rechazaste la solicitud'),
    ).toBeInTheDocument();
  });

  it('shows a conflict without losing the purchase detail', async () => {
    const user = userEvent.setup();
    fetchMock.mockReturnValue(
      jsonResponse(409, {
        message: 'This approval has already been processed',
      }),
    );

    render();

    await user.click(screen.getByRole('button', { name: 'Aprobar' }));

    expect(
      await screen.findByText('No se pudo registrar tu decision'),
    ).toBeInTheDocument();
    expect(screen.getByText('Compra de portatiles')).toBeInTheDocument();
  });
});
