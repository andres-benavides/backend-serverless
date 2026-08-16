import { describe, expect, it } from 'vitest';
import { jsonResponse } from '../../src/shared/http';

describe('jsonResponse', () => {
  it('serializes the body and keeps the status code', () => {
    const response = jsonResponse(201, { requestId: 'abc' });

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body)).toEqual({ requestId: 'abc' });
  });

  it('sets json content type and permissive cors headers', () => {
    const response = jsonResponse(200, {});

    expect(response.headers).toEqual({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
  });
});
