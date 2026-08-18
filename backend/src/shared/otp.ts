import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 180;
export const OTP_MAX_ATTEMPTS = 5;

export const generateOtp = (): string =>
  String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');

export const hashOtp = (approverId: string, otp: string): string =>
  createHash('sha256').update(`${approverId}:${otp}`).digest('hex');

export const otpMatches = (
  approverId: string,
  otp: string,
  storedHash: string,
): boolean => {
  const candidate = Buffer.from(hashOtp(approverId, otp), 'hex');
  const stored = Buffer.from(storedHash, 'hex');

  if (candidate.length !== stored.length) {
    return false;
  }

  return timingSafeEqual(candidate, stored);
};

export const otpExpiresAt = (from: Date): string =>
  new Date(from.getTime() + OTP_TTL_SECONDS * 1000).toISOString();

export const isExpired = (expiresAt: string, now: Date): boolean =>
  now.getTime() > new Date(expiresAt).getTime();
