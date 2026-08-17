import { describe, expect, it } from 'vitest';
import {
  OTP_LENGTH,
  OTP_TTL_SECONDS,
  generateOtp,
  hashOtp,
  isExpired,
  otpExpiresAt,
  otpMatches,
} from '../../src/shared/otp';

describe('otp helpers', () => {
  it('generates a numeric code of the configured length', () => {
    for (let i = 0; i < 200; i += 1) {
      const otp = generateOtp();
      expect(otp).toMatch(new RegExp(`^\\d{${String(OTP_LENGTH)}}$`));
    }
  });

  it('generates different codes across calls', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateOtp()));

    expect(codes.size).toBeGreaterThan(1);
  });

  it('never stores the code in clear text', () => {
    const hash = hashOtp('approver-1', '123456');

    expect(hash).not.toContain('123456');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('salts the hash per approver so the same code differs', () => {
    expect(hashOtp('approver-1', '123456')).not.toBe(
      hashOtp('approver-2', '123456'),
    );
  });

  it('matches the right code and rejects the wrong one', () => {
    const hash = hashOtp('approver-1', '123456');

    expect(otpMatches('approver-1', '123456', hash)).toBe(true);
    expect(otpMatches('approver-1', '654321', hash)).toBe(false);
    expect(otpMatches('approver-2', '123456', hash)).toBe(false);
  });

  it('rejects a malformed stored hash without throwing', () => {
    expect(otpMatches('approver-1', '123456', 'deadbeef')).toBe(false);
  });

  it('expires exactly three minutes after issuing', () => {
    const now = new Date('2026-08-17T10:00:00.000Z');

    expect(otpExpiresAt(now)).toBe('2026-08-17T10:03:00.000Z');
    expect(OTP_TTL_SECONDS).toBe(180);
  });

  it('compares the timestamp explicitly instead of relying on ttl', () => {
    const expiresAt = '2026-08-17T10:03:00.000Z';

    expect(isExpired(expiresAt, new Date('2026-08-17T10:02:59.000Z'))).toBe(
      false,
    );
    expect(isExpired(expiresAt, new Date('2026-08-17T10:03:00.000Z'))).toBe(
      false,
    );
    expect(isExpired(expiresAt, new Date('2026-08-17T10:03:01.000Z'))).toBe(
      true,
    );
  });
});
