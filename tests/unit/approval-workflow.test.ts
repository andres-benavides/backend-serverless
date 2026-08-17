import {
  SendTaskSuccessCommand,
  StartExecutionCommand,
} from '@aws-sdk/client-sfn';
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

  it('reports the decision through the task token', async () => {
    const send = vi.fn().mockResolvedValue({});
    const workflow = new StepFunctionsApprovalWorkflow(stateMachineArn, {
      send,
    } as unknown as ConstructorParameters<
      typeof StepFunctionsApprovalWorkflow
    >[1]);

    const result = await workflow.reportDecision('task-token-1', 'APPROVED');

    expect(result).toBe('DELIVERED');

    const command = send.mock.calls[0][0] as SendTaskSuccessCommand;
    expect(command).toBeInstanceOf(SendTaskSuccessCommand);
    expect(command.input).toEqual({
      taskToken: 'task-token-1',
      output: JSON.stringify({ decision: 'APPROVED' }),
    });
  });

  it('treats an already consumed task as delivered', async () => {
    const taskGone = new Error('Task does not exist');
    taskGone.name = 'TaskDoesNotExist';
    const send = vi.fn().mockRejectedValue(taskGone);
    const workflow = new StepFunctionsApprovalWorkflow(stateMachineArn, {
      send,
    } as unknown as ConstructorParameters<
      typeof StepFunctionsApprovalWorkflow
    >[1]);

    await expect(
      workflow.reportDecision('task-token-1', 'APPROVED'),
    ).resolves.toBe('ALREADY_DELIVERED');
  });

  it('treats a timed out task as delivered', async () => {
    const timedOut = new Error('Task timed out');
    timedOut.name = 'TaskTimedOut';
    const send = vi.fn().mockRejectedValue(timedOut);
    const workflow = new StepFunctionsApprovalWorkflow(stateMachineArn, {
      send,
    } as unknown as ConstructorParameters<
      typeof StepFunctionsApprovalWorkflow
    >[1]);

    await expect(
      workflow.reportDecision('task-token-1', 'REJECTED'),
    ).resolves.toBe('ALREADY_DELIVERED');
  });

  it('propagates unexpected callback failures', async () => {
    const send = vi.fn().mockRejectedValue(new Error('throttled'));
    const workflow = new StepFunctionsApprovalWorkflow(stateMachineArn, {
      send,
    } as unknown as ConstructorParameters<
      typeof StepFunctionsApprovalWorkflow
    >[1]);

    await expect(
      workflow.reportDecision('task-token-1', 'APPROVED'),
    ).rejects.toThrow('throttled');
  });
});
