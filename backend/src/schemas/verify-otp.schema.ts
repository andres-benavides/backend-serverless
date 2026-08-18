import { z } from 'zod';
import { OTP_LENGTH } from '../shared/otp';

export const verifyOtpBodySchema = z.object({
  otp: z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${String(OTP_LENGTH)}}$`)),
});
