import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';

const presignMock = vi.hoisted(() => ({ getSignedUrl: vi.fn() }));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: presignMock.getSignedUrl,
}));

import {
  S3EvidenceStorage,
  evidenceKeyFor,
} from '../../src/infrastructure/evidence-storage';

const bucket = 'evidence-bucket';

const build = () => {
  const send = vi.fn().mockResolvedValue({});
  const storage = new S3EvidenceStorage(bucket, {
    send,
  } as unknown as ConstructorParameters<typeof S3EvidenceStorage>[1]);

  return { send, storage };
};

describe('evidenceKeyFor', () => {
  it('namespaces the object per request', () => {
    expect(evidenceKeyFor('req-1')).toBe('requests/req-1/evidence.pdf');
  });

  it('is deterministic so retries overwrite the same object', () => {
    expect(evidenceKeyFor('req-1')).toBe(evidenceKeyFor('req-1'));
  });
});

describe('S3EvidenceStorage', () => {
  it('uploads the pdf with the right content type', async () => {
    const { send, storage } = build();

    await storage.put('requests/req-1/evidence.pdf', new Uint8Array([1, 2, 3]));

    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input.Bucket).toBe(bucket);
    expect(command.input.Key).toBe('requests/req-1/evidence.pdf');
    expect(command.input.ContentType).toBe('application/pdf');
  });

  it('signs a get request with the requested expiry', async () => {
    presignMock.getSignedUrl.mockResolvedValue('https://signed');
    const { storage } = build();

    const url = await storage.presignedUrl('requests/req-1/evidence.pdf', 300);

    expect(url).toBe('https://signed');

    const [, command, options] = presignMock.getSignedUrl.mock.calls[0] as [
      unknown,
      GetObjectCommand,
      { expiresIn: number },
    ];
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command.input.Key).toBe('requests/req-1/evidence.pdf');
    expect(options.expiresIn).toBe(300);
  });

  it('propagates upload failures', async () => {
    const send = vi.fn().mockRejectedValue(new Error('access denied'));
    const storage = new S3EvidenceStorage(bucket, {
      send,
    } as unknown as ConstructorParameters<typeof S3EvidenceStorage>[1]);

    await expect(
      storage.put('requests/req-1/evidence.pdf', new Uint8Array([1])),
    ).rejects.toThrow('access denied');
  });
});
