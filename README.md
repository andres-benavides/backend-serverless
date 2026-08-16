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

## Despliegue

### Requisitos

SAM CLI. Si el instalador oficial no es viable (requiere `sudo`), se puede instalar en un venv de usuario:

```bash
python3 -m venv ~/.local/sam-cli
~/.local/sam-cli/bin/pip install aws-sam-cli
ln -sf ~/.local/sam-cli/bin/sam ~/.local/bin/sam
```

### Configuracion

```bash
aws configure --profile <perfil>
aws sts get-caller-identity --profile <perfil>
```

### Desplegar

```bash
sam build
sam deploy --profile <perfil> --region us-east-1
```

El stack se llama `amm-purchase-approvals` y se despliega en `us-east-1`. Verifica siempre
con `sts get-caller-identity` que el perfil apunta a la cuenta correcta antes de desplegar.
