import type { APIGatewayProxyResult } from 'aws-lambda';

export const jsonResponse = (
  statusCode: number,
  body: unknown,
): APIGatewayProxyResult => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(body),
});
