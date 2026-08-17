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

## Endpoints

| Metodo | Ruta                             | Descripcion                                                  |
| ------ | -------------------------------- | ------------------------------------------------------------ |
| POST   | `/api/requests`                  | Crea la solicitud junto a sus 3 aprobadores de forma atomica |
| GET    | `/api/requests/{id}`             | Detalle de la solicitud y estado de cada aprobador           |
| GET    | `/api/requests?requesterId=`     | Solicitudes de un solicitante, via Query sobre GSI1          |
| GET    | `/api/approvals/{approvalToken}` | Estado minimo de una aprobacion, via Query sobre GSI2        |

### GET /api/approvals/{approvalToken}

Es el punto de entrada publico del aprobador. Antes de validar el OTP no expone ningun dato
de la compra:

```json
{
  "approval": {
    "status": "PENDING",
    "active": true,
    "requiresOtp": true
  }
}
```

`active` es verdadero solo cuando la solicitud sigue en `PENDING`, el aprobador sigue en
`PENDING` y su `order` coincide con el `currentApproverOrder` de la solicitud. Eso es lo que
impide que los aprobadores 2 y 3 empiecen antes de su turno.

La respuesta nunca incluye `approvalToken`, `taskToken`, `otpHash`, claves `PK`/`SK`, claves
de GSI, ni titulo, descripcion o monto.

| Caso                              | Respuesta                           |
| --------------------------------- | ----------------------------------- |
| Token valido y aprobador activo   | 200 con `active: true`              |
| Token valido fuera de turno       | 200 con `active: false`             |
| Aprobacion ya firmada o rechazada | 200 con el estado y `active: false` |
| Solicitud rechazada o completada  | 200 con `active: false`             |
| Token inexistente                 | 404                                 |
| Token con formato invalido        | 400                                 |

Se responde 200 con `active: false` en vez de 409 porque es una consulta de estado: el
frontend necesita saber en que situacion esta la aprobacion para decidir que pantalla
mostrar, y un error no transporta esa informacion.

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

Las pruebas de integracion corren contra DynamoDB Local: crean su propia tabla con nombre
unico, la usan y la borran al terminar.

No hay que activarlas a mano. `tests/setup.mts` comprueba si DynamoDB Local responde y decide:

| Situacion                    | Resultado                                               |
| ---------------------------- | ------------------------------------------------------- |
| `npm run local:up` levantado | Las 31 pruebas corren                                   |
| Sin Docker                   | Las 4 de integracion se saltan, las 27 unitarias corren |
| `RUN_INTEGRATION_TESTS=0`    | Se saltan aunque la base este arriba                    |
| `RUN_INTEGRATION_TESTS=1`    | Se fuerzan, y fallan si la base no responde             |

El umbral de cobertura esta fijado en 60% para lineas, funciones, ramas y sentencias en
`vitest.config.mts`; por debajo de eso el comando falla.
