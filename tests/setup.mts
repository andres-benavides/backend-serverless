process.env.TABLE_NAME ??= 'purchase-approvals-test';
process.env.DYNAMODB_ENDPOINT ??= 'http://localhost:8000';
process.env.AWS_REGION ??= 'us-east-1';
process.env.AWS_ACCESS_KEY_ID ??= 'local';
process.env.AWS_SECRET_ACCESS_KEY ??= 'local';
process.env.EVIDENCE_BUCKET ??= 'evidence-bucket';
process.env.STATE_MACHINE_ARN ??=
  'arn:aws:states:us-east-1:1:stateMachine:flow';

if (process.env.RUN_INTEGRATION_TESTS === undefined) {
  try {
    await fetch(process.env.DYNAMODB_ENDPOINT, {
      signal: AbortSignal.timeout(2000),
    });
    process.env.RUN_INTEGRATION_TESTS = '1';
  } catch {
    process.env.RUN_INTEGRATION_TESTS = '0';
  }
}
