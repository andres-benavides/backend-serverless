import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import type * as S3 from '@aws-sdk/client-s3';
import type * as Sfn from '@aws-sdk/client-sfn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositoryMock = vi.hoisted(() => ({
  findApproverByToken: vi.fn(),
  findRequestMetadata: vi.fn(),
  findById: vi.fn(),
  saveOtp: vi.fn(),
  incrementOtpAttempts: vi.fn(),
  markOtpVerified: vi.fn(),
  recordDecision: vi.fn(),
  markCallbackSent: vi.fn(),
  saveEvidenceKey: vi.fn(),
}));

const mailMock = vi.hoisted(() => ({ save: vi.fn() }));
const sfnMock = vi.hoisted(() => ({ send: vi.fn() }));
const s3Mock = vi.hoisted(() => ({ send: vi.fn() }));
const presignMock = vi.hoisted(() => ({ getSignedUrl: vi.fn() }));

vi.mock('../../src/repositories/purchase-request.repository', () => ({
  PurchaseRequestRepository: class {
    findApproverByToken = repositoryMock.findApproverByToken;
    findRequestMetadata = repositoryMock.findRequestMetadata;
    findById = repositoryMock.findById;
    saveOtp = repositoryMock.saveOtp;
    incrementOtpAttempts = repositoryMock.incrementOtpAttempts;
    markOtpVerified = repositoryMock.markOtpVerified;
    recordDecision = repositoryMock.recordDecision;
    markCallbackSent = repositoryMock.markCallbackSent;
    saveEvidenceKey = repositoryMock.saveEvidenceKey;
  },
}));

vi.mock('../../src/repositories/mock-mail.repository', () => ({
  MockMailRepository: class {
    save = mailMock.save;
  },
}));

vi.mock('@aws-sdk/client-sfn', async () => {
  const actual = await vi.importActual<typeof Sfn>('@aws-sdk/client-sfn');

  return {
    ...actual,
    SFNClient: class {
      send = sfnMock.send;
    },
  };
});

vi.mock('@aws-sdk/client-s3', async () => {
  const actual = await vi.importActual<typeof S3>('@aws-sdk/client-s3');

  return {
    ...actual,
    S3Client: class {
      send = s3Mock.send;
    },
  };
});

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: presignMock.getSignedUrl,
}));

import { handler as requestOtp } from '../../src/handlers/request-otp';
import { handler as verifyOtp } from '../../src/handlers/verify-otp';
import { handler as submitDecision } from '../../src/handlers/submit-decision';
import { handler as getEvidence } from '../../src/handlers/get-evidence';
import { handler as listMockMails } from '../../src/handlers/list-mock-mails';

const approvalToken = 'a3b1f4c2-1111-4222-8333-444455556666';
const requestId = 'req-1';

const approver = () => ({
  PK: `REQUEST#${requestId}`,
  SK: 'APPROVER#01#approver-1',
  entityType: 'APPROVER',
  requestId,
  approverId: 'approver-1',
  order: 1,
  role: 'Manager',
  name: 'Approver One',
  email: 'one@example.com',
  status: 'PENDING',
  approvalToken,
  taskToken: 'task-token-1',
  createdAt: '2026-08-17T09:00:00.000Z',
  updatedAt: '2026-08-17T09:00:00.000Z',
  GSI2PK: `APPROVAL_TOKEN#${approvalToken}`,
  GSI2SK: `REQUEST#${requestId}#APPROVER#approver-1`,
});

const request = () => ({
  PK: `REQUEST#${requestId}`,
  SK: 'METADATA',
  entityType: 'PURCHASE_REQUEST',
  requestId,
  title: 'Compra',
  description: 'Tres equipos',
  amount: 15000000,
  requester: { id: 'user-001', name: 'Demo', email: 'demo@example.com' },
  status: 'PENDING',
  currentApproverOrder: 1,
  createdAt: '2026-08-17T09:00:00.000Z',
  updatedAt: '2026-08-17T09:00:00.000Z',
  GSI1PK: 'REQUESTER#user-001',
  GSI1SK: 'CREATED_AT#2026-08-17T09:00:00.000Z#REQUEST#req-1',
});

const invoke = async (
  handler: typeof requestOtp,
  event: Partial<APIGatewayProxyEvent>,
) => {
  const result = await handler(
    event as APIGatewayProxyEvent,
    {} as unknown as Context,
    () => undefined,
  );

  return result as APIGatewayProxyResult;
};

const parse = <T>(body: string) => JSON.parse(body) as T;

interface Message {
  message: string;
}

describe('request-otp handler', () => {
  beforeEach(() => {
    Object.values(repositoryMock).forEach((mock) => {
      mock.mockReset();
    });
    mailMock.save.mockReset().mockResolvedValue(undefined);
    repositoryMock.findApproverByToken.mockResolvedValue(approver());
    repositoryMock.findRequestMetadata.mockResolvedValue(request());
    repositoryMock.saveOtp.mockResolvedValue(undefined);
  });

  it('returns 201 with the expiry and no code', async () => {
    const response = await invoke(requestOtp, {
      pathParameters: { approvalToken },
    });
    const body = parse<{ otp: { expiresAt: string } }>(response.body);

    expect(response.statusCode).toBe(201);
    expect(typeof body.otp.expiresAt).toBe('string');
    expect(Object.keys(body.otp)).toEqual(['expiresAt']);
  });

  it('delivers the code only through the mail channel', async () => {
    const response = await invoke(requestOtp, {
      pathParameters: { approvalToken },
    });

    const mail = mailMock.save.mock.calls[0][0] as { otp: string };
    expect(mail.otp).toMatch(/^\d{6}$/);
    expect(response.body).not.toContain(mail.otp);
  });

  it('returns 400 for a malformed token', async () => {
    const response = await invoke(requestOtp, {
      pathParameters: { approvalToken: 'nope' },
    });

    expect(response.statusCode).toBe(400);
    expect(repositoryMock.saveOtp).not.toHaveBeenCalled();
  });

  it('returns 404 when the token is unknown', async () => {
    repositoryMock.findApproverByToken.mockResolvedValue(undefined);

    const response = await invoke(requestOtp, {
      pathParameters: { approvalToken },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 409 when it is not this approver turn', async () => {
    repositoryMock.findRequestMetadata.mockResolvedValue({
      ...request(),
      currentApproverOrder: 2,
    });

    const response = await invoke(requestOtp, {
      pathParameters: { approvalToken },
    });

    expect(response.statusCode).toBe(409);
  });
});

describe('verify-otp handler', () => {
  beforeEach(() => {
    Object.values(repositoryMock).forEach((mock) => {
      mock.mockReset();
    });
    repositoryMock.findApproverByToken.mockResolvedValue(approver());
    repositoryMock.findRequestMetadata.mockResolvedValue(request());
  });

  it('returns 400 when the body is missing', async () => {
    const response = await invoke(verifyOtp, {
      pathParameters: { approvalToken },
      body: null,
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when the body is not json', async () => {
    const response = await invoke(verifyOtp, {
      pathParameters: { approvalToken },
      body: '{ broken',
    });

    expect(response.statusCode).toBe(400);
    expect(parse<Message>(response.body).message).toBe('Invalid JSON body');
  });

  it('returns 409 when no code was requested', async () => {
    const response = await invoke(verifyOtp, {
      pathParameters: { approvalToken },
      body: JSON.stringify({ otp: '123456' }),
    });

    expect(response.statusCode).toBe(409);
  });
});

describe('submit-decision handler', () => {
  beforeEach(() => {
    Object.values(repositoryMock).forEach((mock) => {
      mock.mockReset();
    });
    sfnMock.send.mockReset().mockResolvedValue({});
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('returns 200 and resumes the workflow', async () => {
    repositoryMock.findApproverByToken.mockResolvedValue({
      ...approver(),
      otpVerifiedAt: '2026-08-17T09:59:00.000Z',
    });
    repositoryMock.recordDecision.mockResolvedValue({
      ...approver(),
      status: 'SIGNED',
      signedAt: '2026-08-17T10:00:00.000Z',
    });
    repositoryMock.markCallbackSent.mockResolvedValue(undefined);

    const response = await invoke(submitDecision, {
      pathParameters: { approvalToken },
      body: JSON.stringify({ decision: 'APPROVE' }),
    });

    expect(response.statusCode).toBe(200);
    expect(sfnMock.send).toHaveBeenCalledTimes(1);
  });

  it('returns 400 for an unknown decision', async () => {
    const response = await invoke(submitDecision, {
      pathParameters: { approvalToken },
      body: JSON.stringify({ decision: 'MAYBE' }),
    });

    expect(response.statusCode).toBe(400);
    expect(sfnMock.send).not.toHaveBeenCalled();
  });

  it('returns 409 when the otp was not verified', async () => {
    repositoryMock.findApproverByToken.mockResolvedValue(approver());

    const response = await invoke(submitDecision, {
      pathParameters: { approvalToken },
      body: JSON.stringify({ decision: 'APPROVE' }),
    });

    expect(response.statusCode).toBe(409);
    expect(sfnMock.send).not.toHaveBeenCalled();
  });
});

describe('get-evidence handler', () => {
  beforeEach(() => {
    Object.values(repositoryMock).forEach((mock) => {
      mock.mockReset();
    });
    presignMock.getSignedUrl.mockReset().mockResolvedValue('https://signed');
  });

  it('returns 400 without an id', async () => {
    const response = await invoke(getEvidence, { pathParameters: null });

    expect(response.statusCode).toBe(400);
  });

  it('returns 404 for an unknown request', async () => {
    repositoryMock.findRequestMetadata.mockResolvedValue(undefined);

    const response = await invoke(getEvidence, {
      pathParameters: { id: requestId },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 409 while the evidence does not exist', async () => {
    repositoryMock.findRequestMetadata.mockResolvedValue(request());

    const response = await invoke(getEvidence, {
      pathParameters: { id: requestId },
    });

    expect(response.statusCode).toBe(409);
    expect(presignMock.getSignedUrl).not.toHaveBeenCalled();
  });

  it('returns the signed url once the evidence exists', async () => {
    repositoryMock.findRequestMetadata.mockResolvedValue({
      ...request(),
      status: 'COMPLETED',
      evidenceKey: 'requests/req-1/evidence.pdf',
    });

    const response = await invoke(getEvidence, {
      pathParameters: { id: requestId },
    });
    const body = parse<{ evidence: { url: string; expiresInSeconds: number } }>(
      response.body,
    );

    expect(response.statusCode).toBe(200);
    expect(body.evidence.url).toBe('https://signed');
    expect(body.evidence.expiresInSeconds).toBe(300);
    expect(response.body).not.toContain('evidence-bucket');
  });
});

describe('list-mock-mails handler', () => {
  it('returns 400 for an out of range limit', async () => {
    const response = await invoke(listMockMails, {
      queryStringParameters: { limit: '500' },
    });

    expect(response.statusCode).toBe(400);
  });
});
