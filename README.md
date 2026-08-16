# AMM Purchase Approvals - Backend

Initial AWS serverless backend scaffold for the technical challenge.

## First increment

- REST API with API Gateway
- `POST /api/requests`
- `GET /api/requests/{id}`
- AWS Lambda with TypeScript/Node.js
- DynamoDB single-table model
- Transactional creation of request + 3 approvers
- GSI1 reserved for requester request listing
- GSI2 reserved for approval-token lookup

## Install

```bash
npm install
```

## Validate/build

```bash
sam validate
sam build
```

## Deploy for the first end-to-end test

`sam local start-api` does not create DynamoDB for you. For this first increment, the simplest end-to-end validation is to deploy the stack to a development AWS account. We can add DynamoDB Local later for integration tests.


```bash
sam deploy --guided
```

## Assumptions

- Authentication is not specified by the challenge, so requester identity is mocked in this first increment.
- Approval order is sequential, interpreting "firmas concatenadas" as ordered approvals.
- The approval token is generated at request creation but never returned by the normal request-detail endpoint.
