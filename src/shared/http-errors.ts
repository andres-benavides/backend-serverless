import type { APIGatewayProxyResult } from 'aws-lambda';
import { ZodError } from 'zod';
import { ConflictError, NotFoundError, UnauthorizedError } from './errors';
import { jsonResponse } from './http';

export const toErrorResponse = (
  operation: string,
  error: unknown,
): APIGatewayProxyResult => {
  if (error instanceof SyntaxError) {
    return jsonResponse(400, { message: 'Invalid JSON body' });
  }

  if (error instanceof ZodError) {
    return jsonResponse(400, {
      message: 'Validation failed',
      errors: error.issues,
    });
  }

  if (error instanceof NotFoundError) {
    return jsonResponse(404, { message: error.message });
  }

  if (error instanceof ConflictError) {
    return jsonResponse(409, { message: error.message });
  }

  if (error instanceof UnauthorizedError) {
    return jsonResponse(401, { message: error.message, ...error.details });
  }

  console.error(`${operation} failed`, error);
  return jsonResponse(500, { message: 'Internal server error' });
};
