import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../../src/shared/errors';
import { toErrorResponse } from '../../src/shared/http-errors';

const parse = (body: string) => JSON.parse(body) as Record<string, unknown>;

describe('toErrorResponse', () => {
  it('maps a malformed json body to 400', () => {
    const response = toErrorResponse('op', new SyntaxError('bad json'));

    expect(response.statusCode).toBe(400);
    expect(parse(response.body).message).toBe('Invalid JSON body');
  });

  it('maps a validation failure to 400 with the issues', () => {
    const result = z.object({ a: z.string() }).safeParse({});

    const response = toErrorResponse('op', result.error);

    expect(response.statusCode).toBe(400);
    expect(parse(response.body).message).toBe('Validation failed');
    expect(Array.isArray(parse(response.body).errors)).toBe(true);
  });

  it('maps a missing resource to 404', () => {
    const response = toErrorResponse('op', new NotFoundError('nope'));

    expect(response.statusCode).toBe(404);
    expect(parse(response.body).message).toBe('nope');
  });

  it('maps an invalid state to 409', () => {
    const response = toErrorResponse('op', new ConflictError('already done'));

    expect(response.statusCode).toBe(409);
    expect(parse(response.body).message).toBe('already done');
  });

  it('maps an unauthorized error to 401 and keeps its details', () => {
    const response = toErrorResponse(
      'op',
      new UnauthorizedError('Invalid OTP', { attemptsLeft: 3 }),
    );

    expect(response.statusCode).toBe(401);
    expect(parse(response.body)).toEqual({
      message: 'Invalid OTP',
      attemptsLeft: 3,
    });
  });

  it('maps anything else to 500 without leaking the cause', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const response = toErrorResponse(
      'op',
      new Error('dynamodb table arn:aws:dynamodb:us-east-1:123 exploded'),
    );

    expect(response.statusCode).toBe(500);
    expect(parse(response.body)).toEqual({ message: 'Internal server error' });
    expect(response.body).not.toContain('arn:aws');
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it('never returns a stack trace to the client', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const response = toErrorResponse('op', new Error('boom'));

    expect(response.body).not.toContain('at ');
    expect(response.body).not.toContain('stack');

    consoleError.mockRestore();
  });
});
