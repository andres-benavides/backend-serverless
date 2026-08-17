import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';

export interface ApprovalWorkflow {
  start(requestId: string): Promise<string | undefined>;
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
}
