import { beforeEach, describe, expect, it } from 'vitest';
import { ApiClient, ApiError, DEFAULT_API_BASE_URL } from '@amm/api';
import { jsonResponse, mockFetch } from './helpers';

const client = new ApiClient('https://api.test');

let fetchMock: ReturnType<typeof mockFetch>;

const lastCall = () =>
  fetchMock.mock.calls[0] as [string, RequestInit | undefined];

describe('ApiClient', () => {
  beforeEach(() => {
    fetchMock = mockFetch();
  });

  it('uses the current deployed API as its default', () => {
    expect(DEFAULT_API_BASE_URL).toBe(
      'https://t1nma1q8f3.execute-api.us-east-1.amazonaws.com/dev',
    );
  });

  it('creates a request with a json body', async () => {
    fetchMock.mockReturnValue(
      jsonResponse(201, {
        requestId: 'req-1',
        status: 'PENDING',
        createdAt: '2026-08-17T10:00:00.000Z',
      }),
    );

    const created = await client.createRequest({
      title: 'Compra',
      description: 'Equipos',
      amount: 100,
      requester: { id: 'user-001', name: 'Demo', email: 'demo@example.com' },
      approvers: [],
    });

    const [url, init] = lastCall();

    expect(url).toBe('https://api.test/api/requests');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    );
    expect(created.requestId).toBe('req-1');
  });

  it('unwraps the requests array when listing', async () => {
    fetchMock.mockReturnValue(
      jsonResponse(200, { requests: [{ requestId: 'req-1' }] }),
    );

    const requests = await client.listRequests('user-001');

    expect(requests).toHaveLength(1);
    expect(lastCall()[0]).toBe(
      'https://api.test/api/requests?requesterId=user-001',
    );
  });

  it('encodes identifiers in the url', async () => {
    fetchMock.mockReturnValue(jsonResponse(200, { requests: [] }));

    await client.listRequests('user 001/../admin');

    expect(lastCall()[0]).toContain('user%20001%2F..%2Fadmin');
  });

  it('unwraps the evidence url', async () => {
    fetchMock.mockReturnValue(
      jsonResponse(200, {
        evidence: { url: 'https://signed', expiresInSeconds: 300 },
      }),
    );

    const evidence = await client.getEvidenceUrl('req-1');

    expect(evidence.url).toBe('https://signed');
  });

  it('unwraps the approval view', async () => {
    fetchMock.mockReturnValue(
      jsonResponse(200, {
        approval: { status: 'PENDING', active: true, requiresOtp: true },
      }),
    );

    const approval = await client.getApproval('token-1');

    expect(approval.active).toBe(true);
  });

  it('requests an otp without a body', async () => {
    fetchMock.mockReturnValue(
      jsonResponse(201, { otp: { expiresAt: '2026-08-17T10:03:00.000Z' } }),
    );

    const otp = await client.requestOtp('token-1');

    expect(otp.expiresAt).toBe('2026-08-17T10:03:00.000Z');
    expect(lastCall()[1]?.body).toBeUndefined();
  });

  it('sends the code when verifying', async () => {
    fetchMock.mockReturnValue(
      jsonResponse(200, { purchase: { requestId: 'req-1' } }),
    );

    await client.verifyOtp('token-1', '123456');

    expect(lastCall()[1]?.body).toBe(JSON.stringify({ otp: '123456' }));
  });

  it('sends the decision', async () => {
    fetchMock.mockReturnValue(
      jsonResponse(200, {
        approval: { status: 'SIGNED', decidedAt: '2026-08-17T10:00:00.000Z' },
      }),
    );

    const result = await client.submitDecision('token-1', 'APPROVE');

    expect(result.status).toBe('SIGNED');
    expect(lastCall()[1]?.body).toBe(JSON.stringify({ decision: 'APPROVE' }));
  });

  it('turns an error payload into an ApiError', async () => {
    fetchMock.mockReturnValue(
      jsonResponse(409, { message: 'This approval is not active' }),
    );

    await expect(client.getApproval('token-1')).rejects.toThrow(ApiError);
    await expect(client.getApproval('token-1')).rejects.toThrow(
      'This approval is not active',
    );
  });

  it('keeps the remaining attempts from a 401', async () => {
    fetchMock.mockReturnValue(
      jsonResponse(401, { message: 'Invalid OTP', attemptsLeft: 3 }),
    );

    await expect(client.verifyOtp('token-1', '000000')).rejects.toMatchObject({
      status: 401,
      attemptsLeft: 3,
    });
  });

  it('falls back to a generic message when the body has none', async () => {
    fetchMock.mockReturnValue(jsonResponse(500, {}));

    await expect(client.getRequest('req-1')).rejects.toThrow(
      'Ha ocurrido un error inesperado',
    );
  });

  it('handles an empty response body', async () => {
    fetchMock.mockReturnValue(
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
      }),
    );

    await expect(client.getRequest('req-1')).resolves.toEqual({});
  });

  it('exposes helpers for the common status codes', () => {
    expect(new ApiError(404, 'x').isNotFound).toBe(true);
    expect(new ApiError(409, 'x').isConflict).toBe(true);
    expect(new ApiError(401, 'x').isUnauthorized).toBe(true);
    expect(new ApiError(500, 'x').isNotFound).toBe(false);
  });
});
