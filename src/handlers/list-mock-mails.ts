import type { APIGatewayProxyHandler } from 'aws-lambda';
import { ZodError } from 'zod';
import { MockMailRepository } from '../repositories/mock-mail.repository';
import { listMockMailsQuerySchema } from '../schemas/list-mock-mails.schema';
import { ListMockMailsService } from '../services/list-mock-mails.service';
import { jsonResponse } from '../shared/http';

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error('TABLE_NAME is required');

const repository = new MockMailRepository(tableName);
const service = new ListMockMailsService(repository);

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const input = listMockMailsQuerySchema.parse(
      event.queryStringParameters ?? {},
    );
    const mails = await service.execute(input);

    return jsonResponse(200, { mails });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonResponse(400, {
        message: 'Validation failed',
        errors: error.issues,
      });
    }

    console.error('list-mock-mails failed', error);
    return jsonResponse(500, { message: 'Internal server error' });
  }
};
