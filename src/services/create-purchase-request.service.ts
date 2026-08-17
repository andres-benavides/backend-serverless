import { randomUUID } from 'node:crypto';
import type {
  ApproverItem,
  CreatePurchaseRequestInput,
  PurchaseRequestItem,
} from '../domain/purchase-request';
import type { ApprovalWorkflow } from '../infrastructure/approval-workflow';

import type { PurchaseRequestRepository } from '../repositories/purchase-request.repository';

type WorkflowStarter = Pick<ApprovalWorkflow, 'start'>;

export class CreatePurchaseRequestService {
  constructor(
    private readonly repository: PurchaseRequestRepository,
    private readonly workflow?: WorkflowStarter,
  ) {}

  async execute(input: CreatePurchaseRequestInput) {
    const requestId = randomUUID();
    const now = new Date().toISOString();

    const request: PurchaseRequestItem = {
      PK: `REQUEST#${requestId}`,
      SK: 'METADATA',
      entityType: 'PURCHASE_REQUEST',
      requestId,
      title: input.title,
      description: input.description,
      amount: input.amount,
      requester: input.requester,
      status: 'PENDING',
      currentApproverOrder: 1,
      createdAt: now,
      updatedAt: now,
      GSI1PK: `REQUESTER#${input.requester.id}`,
      GSI1SK: `CREATED_AT#${now}#REQUEST#${requestId}`,
    };

    const approvers: ApproverItem[] = input.approvers.map((approver, index) => {
      const approverId = randomUUID();
      const approvalToken = randomUUID();
      const order = index + 1;

      return {
        PK: `REQUEST#${requestId}`,
        SK: `APPROVER#${String(order).padStart(2, '0')}#${approverId}`,
        entityType: 'APPROVER',
        requestId,
        approverId,
        order,
        role: approver.role,
        name: approver.name,
        email: approver.email,
        status: 'PENDING',
        approvalToken,
        createdAt: now,
        updatedAt: now,
        GSI2PK: `APPROVAL_TOKEN#${approvalToken}`,
        GSI2SK: `REQUEST#${requestId}#APPROVER#${approverId}`,
      };
    });

    await this.repository.create(request, approvers);

    if (this.workflow) {
      const executionArn = await this.workflow.start(requestId);

      if (executionArn) {
        await this.repository.saveExecutionArn(requestId, executionArn);
        request.executionArn = executionArn;
      }
    }

    return {
      request,
      approvers,
    };
  }
}
