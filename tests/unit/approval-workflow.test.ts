import { StartExecutionCommand } from '@aws-sdk/client-sfn';
import { describe, expect, it, vi } from 'vitest';
import { StepFunctionsApprovalWorkflow } from '../../src/infrastructure/approval-workflow';

const stateMachineArn = 'arn:aws:states:us-east-1:1:stateMachine:flow';

describe('StepFunctionsApprovalWorkflow', () => {
  it('starts an execution named after the request', async () => {
    const send = vi.fn().mockResolvedValue({ executionArn: 'arn:execution' });
    const workflow = new StepFunctionsApprovalWorkflow(stateMachineArn, {
      send,
    } as unknown as ConstructorParameters<
      typeof StepFunctionsApprovalWorkflow
    >[1]);

    const executionArn = await workflow.start('req-1');

    expect(executionArn).toBe('arn:execution');

    const command = send.mock.calls[0][0] as StartExecutionCommand;
    expect(command).toBeInstanceOf(StartExecutionCommand);
    expect(command.input).toEqual({
      stateMachineArn,
      name: 'req-1',
      input: JSON.stringify({ requestId: 'req-1' }),
    });
  });

  it('propagates failures from step functions', async () => {
    const send = vi.fn().mockRejectedValue(new Error('throttled'));
    const workflow = new StepFunctionsApprovalWorkflow(stateMachineArn, {
      send,
    } as unknown as ConstructorParameters<
      typeof StepFunctionsApprovalWorkflow
    >[1]);

    await expect(workflow.start('req-1')).rejects.toThrow('throttled');
  });
});
