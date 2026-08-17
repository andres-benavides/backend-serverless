import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { DashboardView } from '../apps/requester/src/views/DashboardView';
import { CreateRequestView } from '../apps/requester/src/views/CreateRequestView';
import { RequestDetailView } from '../apps/requester/src/views/RequestDetailView';
import { jsonResponse, mockFetch, renderAt } from './helpers';

let fetchMock: ReturnType<typeof mockFetch>;

const summary = (overrides = {}) => ({
  requestId: 'req-1',
  title: 'Compra de portatiles',
  description: 'Tres equipos',
  amount: 15000000,
  requester: { id: 'user-001', name: 'Demo', email: 'demo@example.com' },
  status: 'PENDING',
  currentApproverOrder: 2,
  createdAt: '2026-08-17T09:00:00.000Z',
  updatedAt: '2026-08-17T09:00:00.000Z',
  ...overrides,
});

const approver = (order: number, status = 'PENDING', signedAt?: string) => ({
  approverId: `approver-${String(order)}`,
  order,
  role: 'Manager',
  name: `Approver ${String(order)}`,
  email: `a${String(order)}@example.com`,
  status,
  signedAt,
});

describe('DashboardView', () => {
  beforeEach(() => {
    fetchMock = mockFetch();
  });

  it('shows a skeleton while loading', () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));

    renderAt(<DashboardView />);

    expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument();
  });

  it('lists the requests with their status', async () => {
    fetchMock.mockReturnValue(jsonResponse(200, { requests: [summary()] }));

    renderAt(<DashboardView />);

    expect(await screen.findByText('Compra de portatiles')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.getByText('Aprobador 2')).toBeInTheDocument();
  });

  it('shows an empty state with a call to action', async () => {
    fetchMock.mockReturnValue(jsonResponse(200, { requests: [] }));

    renderAt(<DashboardView />);

    expect(
      await screen.findByText(/Todavia no has creado ninguna solicitud/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Crear la primera' }),
    ).toBeInTheDocument();
  });

  it('surfaces a load failure', async () => {
    fetchMock.mockReturnValue(jsonResponse(500, { message: 'boom' }));

    renderAt(<DashboardView />);

    expect(
      await screen.findByText('No se pudieron cargar las solicitudes'),
    ).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('hides the turn column for closed requests', async () => {
    fetchMock.mockReturnValue(
      jsonResponse(200, { requests: [summary({ status: 'COMPLETED' })] }),
    );

    renderAt(<DashboardView />);

    expect(await screen.findByText('Completada')).toBeInTheDocument();
    expect(screen.queryByText('Aprobador 2')).not.toBeInTheDocument();
  });
});

describe('CreateRequestView', () => {
  beforeEach(() => {
    fetchMock = mockFetch();
  });

  const fillForm = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText('Titulo'), 'Compra');
    await user.type(screen.getByLabelText('Descripcion'), 'Equipos');
    await user.type(screen.getByLabelText('Monto'), '5000');

    const roles = ['Manager', 'Finance', 'Director'];

    for (const [index, role] of roles.entries()) {
      const position = index + 1;
      await user.type(screen.getByLabelText(`Rol ${String(position)}`), role);
      await user.type(
        screen.getAllByLabelText('Nombre')[index],
        `Approver ${String(position)}`,
      );
      await user.type(
        screen.getAllByLabelText('Correo')[index],
        `a${String(position)}@example.com`,
      );
    }
  };

  it('renders three approver blocks', () => {
    renderAt(<CreateRequestView />);

    expect(screen.getByLabelText('Rol 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Rol 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Rol 3')).toBeInTheDocument();
  });

  it('sends the typed values to the api', async () => {
    const user = userEvent.setup();
    fetchMock.mockReturnValue(
      jsonResponse(201, {
        requestId: 'req-9',
        status: 'PENDING',
        createdAt: '2026-08-17T10:00:00.000Z',
      }),
    );

    renderAt(<CreateRequestView />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Crear solicitud' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    ) as { title: string; amount: number; approvers: { role: string }[] };

    expect(body.title).toBe('Compra');
    expect(body.amount).toBe(5000);
    expect(body.approvers.map((a) => a.role)).toEqual([
      'Manager',
      'Finance',
      'Director',
    ]);
  });

  it('shows the backend validation message', async () => {
    const user = userEvent.setup();
    fetchMock.mockReturnValue(
      jsonResponse(422, { message: 'Validation failed' }),
    );

    renderAt(<CreateRequestView />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Crear solicitud' }));

    expect(
      await screen.findByText('No se pudo crear la solicitud'),
    ).toBeInTheDocument();
  });
});

describe('RequestDetailView', () => {
  beforeEach(() => {
    fetchMock = mockFetch();
  });

  const renderDetail = () =>
    renderAt(
      <Routes>
        <Route path="/requests/:requestId" element={<RequestDetailView />} />
      </Routes>,
      '/requests/req-1',
    );

  it('shows the approvers in order with their signature date', async () => {
    fetchMock.mockReturnValue(
      jsonResponse(200, {
        request: summary(),
        approvers: [
          approver(1, 'SIGNED', '2026-08-17T09:30:00.000Z'),
          approver(2),
          approver(3),
        ],
      }),
    );

    renderDetail();

    expect(await screen.findByText('Approver 1')).toBeInTheDocument();
    expect(screen.getByText('Firmado')).toBeInTheDocument();
  });

  it('hides the download button while the request is pending', async () => {
    fetchMock.mockReturnValue(
      jsonResponse(200, { request: summary(), approvers: [approver(1)] }),
    );

    renderDetail();

    expect(
      await screen.findByText(/El PDF de evidencia estara disponible/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Descargar PDF' }),
    ).not.toBeInTheDocument();
  });

  it('opens the presigned url when the request is completed', async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    vi.stubGlobal('open', open);

    fetchMock
      .mockReturnValueOnce(
        jsonResponse(200, {
          request: summary({ status: 'COMPLETED' }),
          approvers: [approver(1, 'SIGNED', '2026-08-17T09:30:00.000Z')],
        }),
      )
      .mockReturnValueOnce(
        jsonResponse(200, {
          evidence: { url: 'https://signed.pdf', expiresInSeconds: 300 },
        }),
      );

    renderDetail();

    await user.click(
      await screen.findByRole('button', { name: 'Descargar PDF' }),
    );

    await waitFor(() => {
      expect(open).toHaveBeenCalledWith(
        'https://signed.pdf',
        '_blank',
        'noopener',
      );
    });
  });

  it('surfaces an evidence failure without breaking the page', async () => {
    const user = userEvent.setup();

    fetchMock
      .mockReturnValueOnce(
        jsonResponse(200, {
          request: summary({ status: 'COMPLETED' }),
          approvers: [approver(1, 'SIGNED')],
        }),
      )
      .mockReturnValueOnce(jsonResponse(409, { message: 'not ready' }));

    renderDetail();

    await user.click(
      await screen.findByRole('button', { name: 'Descargar PDF' }),
    );

    expect(
      await screen.findByText('No se pudo obtener la evidencia'),
    ).toBeInTheDocument();
    expect(screen.getByText('Compra de portatiles')).toBeInTheDocument();
  });

  it('does not call the api while a required field is empty', async () => {
    const user = userEvent.setup();

    renderAt(<CreateRequestView />);

    await user.type(screen.getByLabelText('Titulo'), 'Solo el titulo');
    await user.click(screen.getByRole('button', { name: 'Crear solicitud' }));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
