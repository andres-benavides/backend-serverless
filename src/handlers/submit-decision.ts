import type { APIGatewayProxyHandler } from 'aws-lambda';
import { StepFunctionsApprovalWorkflow } from '../infrastructure/approval-workflow';
import { PurchaseRequestRepository } from '../repositories/purchase-request.repository';
import { approvalTokenParamsSchema } from '../schemas/approval-token.schema';
import { decisionBodySchema } from '../schemas/decision.schema';
import { SubmitDecisionService } from '../services/submit-decision.service';
import { jsonResponse } from '../shared/http';
import { toErrorResponse } from '../shared/http-errors';

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error('TABLE_NAME is required');

const stateMachineArn = process.env.STATE_MACHINE_ARN ?? '';

const service = new SubmitDecisionService(
  new PurchaseRequestRepository(tableName),
  new StepFunctionsApprovalWorkflow(stateMachineArn),
);

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { approvalToken } = approvalTokenParamsSchema.parse(
      event.pathParameters ?? {},
    );
    const { decision } = decisionBodySchema.parse(
      JSON.parse(event.body ?? '{}') as unknown,
    );

    const result = await service.execute(approvalToken, decision);

    console.log(
      JSON.stringify({
        operation: 'submit-decision',
        approvalToken,
        decision,
        status: result.status,
      }),
    );

    return jsonResponse(200, { approval: result });
  } catch (error) {
    return toErrorResponse('submit-decision', error);
  }
};
