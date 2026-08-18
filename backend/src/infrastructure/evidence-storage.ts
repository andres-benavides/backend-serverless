import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface EvidenceStorage {
  put(key: string, body: Uint8Array): Promise<void>;
  presignedUrl(key: string, expiresInSeconds: number): Promise<string>;
}

export const evidenceKeyFor = (requestId: string): string =>
  `requests/${requestId}/evidence.pdf`;

export class S3EvidenceStorage implements EvidenceStorage {
  constructor(
    private readonly bucket: string,
    private readonly client = new S3Client({}),
  ) {}

  async put(key: string, body: Uint8Array): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: 'application/pdf',
      }),
    );
  }

  async presignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }
}
