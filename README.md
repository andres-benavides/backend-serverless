# AMM Purchase Approvals - Backend

Initial AWS serverless backend scaffold for the technical challenge.

## First increment

- REST API with API Gateway
- `POST /api/requests`
- `GET /api/requests/{id}`
- `GET /api/requests?requesterId={id}` using a `Query` on GSI1
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

## Desarrollo local

El entorno local se levanta con Docker Compose: DynamoDB Local mas un servicio de
inicializacion que espera a que este listo y crea la tabla con el mismo esquema del
`template.yaml`.

```bash
npm run local:up      # docker compose up -d
npm run local:api     # sam build + sam local start-api
npm run local:down    # docker compose down
```

```bash
curl -X POST http://127.0.0.1:3000/api/requests \
  -H 'Content-Type: application/json' -d @events-create-request.json

curl 'http://127.0.0.1:3000/api/requests?requesterId=user-001'
```

The list endpoint returns request metadata ordered from newest to oldest. It does not return
DynamoDB keys or approver tokens. `requesterId` is required; a requester without requests
receives `{ "requests": [] }`.

### Puerto

El contenedor siempre escucha en el 8000 dentro de la red `sam-local`, que es lo que usa la
Lambda. El puerto publicado en el host es configurable si el 8000 ya esta ocupado:

```bash
DYNAMODB_LOCAL_PORT=8123 npm run local:up
DYNAMODB_ENDPOINT=http://localhost:8123 npm run test:integration
```

### Detalles que no son obvios

`-sharedDb` es obligatorio: sin esa bandera DynamoDB Local particiona los datos por access
key, y la tabla creada desde el host no seria visible para el contenedor de Lambda, que usa
credenciales distintas.

`-inMemory` significa que los datos se pierden al bajar el stack. `docker compose up` vuelve
a crear la tabla vacia.

`env.local.json` usa la clave global `Parameters`. SAM local solo puede **sobrescribir**
variables ya declaradas en el template, por eso `DYNAMODB_ENDPOINT` esta declarado en
`Globals` con valor vacio: en AWS queda vacio y el SDK usa el endpoint real, en local se
sobrescribe apuntando al contenedor.

## Pruebas

```bash
npm test              # unitarias
npm run test:coverage # unitarias + reporte de cobertura
npm run test:integration
```

Las pruebas de integracion corren contra DynamoDB Local: crean su propia tabla, la usan y la
borran. Estan detras de `RUN_INTEGRATION_TESTS=1` para que `npm test` funcione en maquinas o
pipelines sin Docker.

El umbral de cobertura esta fijado en 60% para lineas, funciones, ramas y sentencias en
`vitest.config.mts`; por debajo de eso el comando falla.
