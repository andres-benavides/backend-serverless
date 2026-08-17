import {
  SFNClient,
  SendTaskSuccessCommand,
  StartExecutionCommand,
} from '@aws-sdk/client-sfn';

export type WorkflowDecision = 'APPROVED' | 'REJECTED';

export interface ApprovalWorkflow {
  start(requestId: string): Promise<string | undefined>;
  reportDecision(
    taskToken: string,
    decision: WorkflowDecision,
  ): Promise<'DELIVERED' | 'ALREADY_DELIVERED'>;
}

export class StepFunctionsApprovalWorkflow implements ApprovalWorkflow {
  constructor(
    private readonly stateMachineArn: string,
    private readonly client = new SFNClient({}),
  ) {}

  async start(requestId: string): Promise<string | undefined> {
    const result = await this.client.send(
      new StartExecutionCommand({
        stateMachineArn: this.stateMachineArn,
        name: requestId,
        input: JSON.stringify({ requestId }),
      }),
    );

    return result.executionArn;
  }

  async reportDecision(
    taskToken: string,
    decision: WorkflowDecision,
  ): Promise<'DELIVERED' | 'ALREADY_DELIVERED'> {
    try {
      await this.client.send(
        new SendTaskSuccessCommand({
          taskToken,
          output: JSON.stringify({ decision }),
        }),
      );

      return 'DELIVERED';
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'TaskDoesNotExist' || error.name === 'TaskTimedOut')
      ) {
        return 'ALREADY_DELIVERED';
      }

      throw error;
    }
  }
}
