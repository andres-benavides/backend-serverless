# AMM Purchase Approvals

Flujo de aprobaciones de compra con firmas digitales concatenadas, resuelto con una arquitectura
serverless en AWS. Prueba tecnica para perfil fullstack senior.

## URLs de prueba

|                    |                                                                      |
| ------------------ | -------------------------------------------------------------------- |
| **Aplicacion**     | https://d2jbn2huy2ajh.cloudfront.net                                 |
| **API**            | https://5oxai8sky9.execute-api.us-east-1.amazonaws.com/dev           |
| **Buzon simulado** | https://5oxai8sky9.execute-api.us-east-1.amazonaws.com/dev/mock-mail |

Para recorrer el flujo completo sin salir del navegador: crea una solicitud, abre **Bandeja**, y
desde ahi entra a la aprobacion con su codigo OTP a la vista.

## Que hay implementado

Una solicitud se crea con tres aprobadores. Una maquina de estados de Step Functions los activa
**en orden**: el aprobador 2 no puede actuar hasta que el 1 firme. Cada uno recibe un link con su
token, valida un OTP de 6 digitos vigente 3 minutos, y decide. Al firmar el tercero se genera un
PDF de evidencia que se descarga con una URL prefirmada.

| Componente   | Tecnologia                                               |
| ------------ | -------------------------------------------------------- |
| API REST     | API Gateway + Lambda (TypeScript, Node 22)               |
| Persistencia | DynamoDB single-table con GSI1 y GSI2                    |
| Orquestacion | Step Functions Standard con `waitForTaskToken`           |
| Evidencia    | `pdf-lib` + S3 privado con presigned URL                 |
| Frontend     | React 18 + micro-frontends con webpack Module Federation |
| IaC          | AWS SAM / CloudFormation                                 |

```
Backend   236 pruebas   97% cobertura
Frontend   50 pruebas   89% cobertura
```

El codigo del frontend vive en [`frontend/`](frontend/) y tiene su propio README.

## Requisitos

- Node 22 (hay un `.nvmrc`)
- AWS SAM CLI
- Docker, solo para el entorno local

## Instalar

```bash
npm install
```

## Validar y construir

```bash
sam validate
sam build
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

## Flujo de aprobacion

"Firmas concatenadas" se interpreta como aprobaciones **secuenciales**: el aprobador 2 no
puede actuar hasta que el 1 firme. La orquestacion vive en una maquina de estados de
AWS Step Functions **Standard**.

```
ActivateApprover1 -> espera callback -> APPROVED?
   |- si -> ActivateApprover2 -> espera -> APPROVED?
   |          |- si -> ActivateApprover3 -> espera -> APPROVED?
   |          |          |- si -> GenerateEvidence -> CompleteRequest
   |          |          |- no -> RejectRequest
   |          |- no -> RejectRequest
   |- no -> RejectRequest
```

Definicion en `statemachine/approval-flow.asl.json`.

### Por que Standard y no Express

Las esperas son de interaccion humana: una aprobacion puede tardar minutos, horas o dias.
Express tiene un limite de 5 minutos de ejecucion y no soporta el patron de callback. Standard
permite ejecuciones de hasta un ano y `waitForTaskToken`.

### Task token

Cada estado `ActivateApproverN` invoca la Lambda con
`arn:aws:states:::lambda:invoke.waitForTaskToken`. La Lambda guarda el `taskToken` contra el
aprobador y termina; la ejecucion queda esperando el callback.

Hay **dos tokens distintos** y no deben confundirse:

| Token           | Alcance                                     | Se expone al navegador |
| --------------- | ------------------------------------------- | ---------------------- |
| `approvalToken` | Publico, identifica al aprobador en su link | Si                     |
| `taskToken`     | Interno de Step Functions                   | **Nunca**              |

El `taskToken` y el `executionArn` estan excluidos de todas las respuestas de la API.

### Activacion y concurrencia

`activateApprover` escribe el `taskToken` del aprobador y el `currentApproverOrder` de la
solicitud en un solo `TransactWriteItems`, ambos con `ConditionExpression` sobre
`status = PENDING`. Si la solicitud ya fue rechazada o completada, la activacion falla en vez
de dejar el modelo inconsistente.

`updateRequestStatus` tambien es condicional sobre `PENDING`, asi que un callback repetido no
puede pasar de `REJECTED` a `COMPLETED` ni al reves.

### Doble escritura conocida

`POST /api/requests` hace dos cosas que no pueden ir en una sola transaccion: escribe en
DynamoDB e inicia la ejecucion en Step Functions. Si el `StartExecution` falla, la solicitud
queda persistida en `PENDING` sin `executionArn` y el endpoint responde 500.

Se eligio propagar el error en vez de silenciarlo, porque una solicitud sin workflow nunca
avanzaria y quedaria invisible. Las solicitudes en ese estado son identificables justamente
por no tener `executionArn`.

La solucion definitiva seria disparar la maquina de estados desde un DynamoDB Stream
(patron outbox), lo que elimina la doble escritura. No se implemento para no anadir un
componente mas a la prueba.

`StartExecution` usa el `requestId` como nombre de ejecucion, de modo que un reintento con el
mismo id no crea una segunda ejecucion.

### Permiso amplio justificado

El rol de la maquina de estados incluye acciones `logs:*LogDelivery` sobre `Resource: '*'`.
Es un requisito de AWS: el logging de Step Functions no admite ARNs concretos en esas
acciones. Sin ellas el despliegue falla con
`The state machine IAM Role is not authorized to access the Log Destination`.

## Mock Mail

El PDF permite simular el envio de correo. Cuando Step Functions activa a un aprobador, la
Lambda `activate-approver` graba un correo simulado con su link de aprobacion.

```http
GET /mock-mail
GET /mock-mail?requestId={id}
GET /mock-mail?limit=10
```

```json
{
  "mails": [
    {
      "to": "one@example.com",
      "approverName": "Approver One",
      "role": "Manager",
      "order": 1,
      "subject": "Aprobacion pendiente de la solicitud ...",
      "approvalLink": "https://d2jbn2huy2ajh.cloudfront.net/approve?solicitud_id=...&approver_token=...",
      "sentAt": "2026-08-17T01:23:06.179Z"
    }
  ]
}
```

El formato del link sigue el ejemplo del enunciado.

> **Endpoint de demostracion.** `/mock-mail` expone `approvalToken`, que es lo que en
> produccion llegaria unicamente al buzon del aprobador. Existe para poder probar el flujo sin
> SMTP y **debe eliminarse o protegerse antes de cualquier uso real**.

### Solo se envia cuando llega el turno

El correo se emite desde la activacion, no desde la creacion de la solicitud. Los aprobadores
2 y 3 no reciben nada hasta que el anterior firma. Comprobado end to end:

| Momento                    | `GET /api/approvals/{token2}` | Correos del aprobador 2 |
| -------------------------- | ----------------------------- | ----------------------- |
| Antes de su turno          | `active: false`               | 0                       |
| Tras firmar el aprobador 1 | `active: true`                | 1                       |

### Preparado para SES

`activate-approver` depende de la interfaz `MailSender`, no de DynamoDB. `MockMailSender` es
la implementacion actual; sustituirla por una `SesMailSender` no requiere tocar el servicio.

### Modelo de datos

Los correos viven en la misma tabla: `PK = REQUEST#{requestId}`, `SK = MAIL#{approverId}`.
La bandeja global se resuelve por GSI1 con `GSI1PK = MOCK_MAIL` y
`GSI1SK = SENT_AT#{sentAt}#MAIL#{mailId}`, ordenada descendente. Reutiliza el indice existente
en vez de anadir uno nuevo, y no interfiere con las consultas por `REQUESTER#`.

## OTP

Cada aprobador debe validar un codigo de 6 digitos antes de poder ver el detalle de la compra.

```http
POST /api/approvals/{approvalToken}/otp
POST /api/approvals/{approvalToken}/otp/verify
```

`POST /otp` genera el codigo y lo entrega por el canal de correo simulado. La respuesta
devuelve solo la expiracion, nunca el codigo:

```json
{ "otp": { "expiresAt": "2026-08-17T01:38:40.676Z" } }
```

`POST /otp/verify` recibe `{ "otp": "861385" }`. Si acierta, responde con el detalle de la
compra, que es lo que el aprobador necesita para decidir.

### Almacenamiento

Solo se guarda `sha256(approverId:otp)`, nunca el codigo en claro. El `approverId` actua como
sal, de modo que el mismo codigo produce hashes distintos para aprobadores distintos. La
comparacion usa `timingSafeEqual`.

Un hash rapido es suficiente aqui porque el codigo vive 3 minutos y admite 5 intentos: la
proteccion real contra fuerza bruta es el limite de intentos, no el coste del hash. El hash
existe para no almacenar el secreto en reposo.

### Expiracion

`otpExpiresAt` se compara **explicitamente** contra el reloj en cada verificacion. No se usa
el TTL de DynamoDB para decidir validez: su borrado puede tardar hasta 48 horas y aceptaria
codigos vencidos. El TTL solo serviria como limpieza.

### Intentos

`otpAttempts` se incrementa con `ADD` atomico en cada fallo. Al llegar a 5 el codigo queda
bloqueado y hay que pedir uno nuevo, lo que reinicia el contador.

| Caso                               | Respuesta                       |
| ---------------------------------- | ------------------------------- |
| Codigo correcto                    | 200 con el detalle de la compra |
| Codigo incorrecto                  | 401 con `attemptsLeft`          |
| Codigo vencido                     | 409                             |
| 5 intentos agotados                | 409                             |
| Sin codigo solicitado              | 409                             |
| Fuera de turno o solicitud cerrada | 409                             |
| Formato invalido                   | 400                             |
| Token inexistente                  | 404                             |

Comprobado end to end contra AWS: los 5 intentos degradan `attemptsLeft` de 4 a 0 y el sexto
devuelve 409.

### Manejo de errores centralizado

`src/shared/http-errors.ts` traduce los errores de dominio (`NotFoundError`, `ConflictError`,
`UnauthorizedError`, `ZodError`) a codigos HTTP en un unico lugar. Los handlers solo delegan,
y ningun stack trace llega al cliente.

## Decision del aprobador

```http
POST /api/approvals/{approvalToken}/decision
```

```json
{ "decision": "APPROVE" }
```

Requisitos para que la decision se acepte: token valido, turno del aprobador, OTP verificado y
estado `PENDING`.

### El problema de la doble escritura

Registrar la firma en DynamoDB y reanudar Step Functions son dos sistemas distintos y no caben
en una transaccion. El orden elegido es:

```
1. UpdateItem condicional sobre el aprobador  ->  devuelve el taskToken
2. SendTaskSuccess hacia Step Functions
3. UpdateItem marcando callbackSentAt
```

DynamoDB va primero porque es la fuente de verdad: si el proceso muere entre 1 y 2, la firma
quedo registrada pero el workflow sigue esperando. Ese estado es **detectable y reparable**,
porque el aprobador tiene `status = SIGNED` sin `callbackSentAt`.

Al reintentar la misma decision, el servicio detecta ese estado y **reenvia solo el callback**,
sin volver a escribir la firma. Reintentar es seguro.

El orden inverso seria peor: notificar primero dejaria el workflow avanzando sobre una firma
que nunca se persistio, y eso no se puede reparar.

### Proteccion contra doble firma

El `UpdateItem` del paso 1 lleva:

```
ConditionExpression:
  #status = PENDING
  AND attribute_exists(otpVerifiedAt)
  AND attribute_exists(taskToken)
```

Un segundo click, un reintento del navegador o dos peticiones simultaneas fallan la condicion.
Solo una puede pasar de `PENDING` a un estado final.

Ademas, `SendTaskSuccess` sobre un token ya consumido devuelve `TaskDoesNotExist` o
`TaskTimedOut`; ambos se tratan como entrega ya realizada en vez de propagarse como error, de
modo que el reintento converge.

| Caso                         | Respuesta                      |
| ---------------------------- | ------------------------------ |
| Decision valida              | 200 con `status` y `decidedAt` |
| OTP sin verificar            | 409                            |
| Ya procesada y notificada    | 409                            |
| Procesada pero sin notificar | 200, reenvia el callback       |
| Token inexistente            | 404                            |
| `decision` invalida          | 400                            |

### Permiso amplio justificado

`states:SendTaskSuccess` y `states:SendTaskFailure` van con `Resource: '*'` porque el task
token no es un ARN: AWS no admite permisos a nivel de recurso para esas acciones.

## Evidencia en PDF

Cuando los tres aprobadores firman, la maquina de estados invoca `GenerateEvidenceFunction`,
que arma el PDF con `pdf-lib` y lo sube a S3 antes de marcar la solicitud como `COMPLETED`.

```http
GET /api/requests/{id}/evidence
```

```json
{
  "evidence": {
    "url": "https://...s3.us-east-1.amazonaws.com/requests/{id}/evidence.pdf?X-Amz-...",
    "expiresInSeconds": 300
  }
}
```

Contenido del documento: titulo, descripcion, monto, fecha de creacion, solicitante y una tabla
con los tres aprobadores, su rol, su estado y el timestamp de cada firma.

Los campos extensos se ajustan al ancho disponible sin truncarse. Si la descripcion no cabe en
la primera pagina, el documento crea paginas de continuacion y conserva todo el contenido.

### El bucket es privado

El bucket bloquea todo acceso publico (`BlockPublicAcls`, `BlockPublicPolicy`,
`IgnorePublicAcls`, `RestrictPublicBuckets`), cifra en reposo con AES256 y tiene versionado.

La descarga se hace con una **presigned URL de 5 minutos**. Verificado contra AWS: la URL
firmada devuelve 200 con `application/pdf`, y la misma ruta sin firma devuelve **403**.

DynamoDB solo guarda `evidenceKey` (`requests/{requestId}/evidence.pdf`), nunca el binario.

### El resultado se deriva de las firmas

El PDF se genera **antes** de que `CompleteRequest` marque la solicitud como `COMPLETED`, asi
que leer `request.status` en ese momento mostraria `PENDING` en el documento. El campo
`Resultado` se calcula desde el estado de los aprobadores, que es lo que la evidencia realmente
certifica, y no depende del orden de escritura del workflow.

### Reintentos

El estado `GenerateEvidence` reintenta hasta 3 veces con backoff exponencial. La generacion es
idempotente: la clave en S3 es determinista, asi que un reintento sobrescribe el mismo objeto.

| Caso                    | Respuesta              |
| ----------------------- | ---------------------- |
| Evidencia disponible    | 200 con la URL firmada |
| Aun sin las tres firmas | 409                    |
| Solicitud inexistente   | 404                    |

### Diferencia con el enunciado

El PDF de la prueba nombra el endpoint como `/api/solicitudes/{id}/evidencia.pdf`. Se
implemento como `/api/requests/{id}/evidence` por coherencia con el resto de la API, que esta
en ingles, y porque devuelve una URL firmada en JSON en lugar del binario. Si se prefiere la
ruta literal del enunciado, es solo anadir un evento mas a la misma Lambda.

## Documentacion de la API

La especificacion OpenAPI 3.0 esta en [`docs/openapi.yaml`](docs/openapi.yaml) y cubre los
nueve endpoints con sus cuerpos, respuestas, codigos HTTP, ejemplos y errores.

Para verla renderizada:

```bash
npx @redocly/cli preview-docs docs/openapi.yaml
```

o pegar el archivo en <https://editor.swagger.io>.

La documentacion **no puede desincronizarse** de la implementacion: una prueba compara las
rutas del `template.yaml` contra las del documento y falla si no coinciden exactamente. Tambien
verifica que cada operacion tenga resumen, respuestas y un 500 documentado, que todas las
referencias internas resuelvan, y que no se documente ningun campo interno como parte de una
respuesta.

## Instrucciones para probar el flujo completo

Todo el recorrido se puede ejecutar con `curl` contra el entorno desplegado. `BASE` es la URL
del stage.

```bash
BASE=https://5oxai8sky9.execute-api.us-east-1.amazonaws.com/dev
```

**1. Crear la solicitud.** Arranca el workflow y activa al primer aprobador.

```bash
curl -X POST "$BASE/api/requests" \
  -H 'Content-Type: application/json' \
  -d @events-create-request.json
```

**2. Leer el correo simulado.** Solo aparece el del aprobador en turno.

```bash
curl "$BASE/mock-mail?requestId=<REQUEST_ID>"
```

El `approvalLink` contiene el `approver_token` que se usa en los pasos siguientes.

**3. Consultar el estado de la aprobacion.** Antes del OTP no expone datos de la compra.

```bash
curl "$BASE/api/approvals/<APPROVAL_TOKEN>"
```

**4. Pedir el OTP.** La respuesta trae solo la expiracion; el codigo se lee del buzon simulado.

```bash
curl -X POST "$BASE/api/approvals/<APPROVAL_TOKEN>/otp"
curl "$BASE/mock-mail?requestId=<REQUEST_ID>"
```

**5. Verificar el OTP.** Devuelve el detalle de la compra.

```bash
curl -X POST "$BASE/api/approvals/<APPROVAL_TOKEN>/otp/verify" \
  -H 'Content-Type: application/json' \
  -d '{"otp":"<CODIGO>"}'
```

**6. Decidir.** Al firmar, el workflow activa al siguiente aprobador y emite su correo.

```bash
curl -X POST "$BASE/api/approvals/<APPROVAL_TOKEN>/decision" \
  -H 'Content-Type: application/json' \
  -d '{"decision":"APPROVE"}'
```

Repetir los pasos 2 a 6 para los aprobadores 2 y 3.

**7. Descargar la evidencia.** Tras la tercera firma la solicitud pasa a `COMPLETED`.

```bash
curl "$BASE/api/requests/<REQUEST_ID>/evidence"
curl -o evidencia.pdf "<URL_PREFIRMADA>"
```

**Seguimiento del solicitante** en cualquier momento:

```bash
curl "$BASE/api/requests?requesterId=user-001"
curl "$BASE/api/requests/<REQUEST_ID>"
```

### Casos de error que vale la pena probar

| Comprobacion         | Como                                           | Esperado                |
| -------------------- | ---------------------------------------------- | ----------------------- |
| Roles repetidos      | Dos aprobadores con el mismo `role`            | 422                     |
| Fuera de turno       | Consultar el token del aprobador 2 al inicio   | 200 con `active: false` |
| Decidir sin OTP      | Saltarse los pasos 4 y 5                       | 409                     |
| OTP incorrecto       | Enviar `000000`                                | 401 con `attemptsLeft`  |
| Intentos agotados    | Fallar seis veces                              | 409                     |
| Doble firma          | Repetir el paso 6                              | 409                     |
| Evidencia anticipada | Paso 7 antes de las tres firmas                | 409                     |
| Bucket privado       | Abrir la URL de S3 sin los parametros de firma | 403                     |

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
sam deploy \
  --profile <perfil> \
  --region us-east-1 \
  --parameter-overrides \
  AppBaseUrl=https://<distribucion>.cloudfront.net
```

`AppBaseUrl` es obligatorio y debe ser la URL HTTPS del frontend. No tiene un valor por
defecto deliberadamente: asi un despliegue nuevo no puede emitir correos con un dominio de
ejemplo. El entorno de prueba ya queda configurado en `samconfig.toml` con su distribucion de
CloudFront.

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
npm test              # unitarias + integracion
npm run test:coverage # con reporte de cobertura
npm run test:integration
```

```
228 pruebas | 26 archivos
Cobertura: 97% sentencias | 89% ramas | 98% funciones
```

El umbral configurado en `vitest.config.mts` es 85% (sentencias, lineas y funciones) y 80% en
ramas, por encima del 60% que exige la prueba. Por debajo de eso el comando falla.

### Unitarias

Cubren servicios, schemas, handlers, generacion del PDF, helpers de OTP y el mapeo
centralizado de errores. El SDK de AWS se mockea, asi que **no necesitan una cuenta de AWS**.

Varias son pruebas de seguridad explicitas: que la API nunca devuelva `approvalToken`,
`taskToken`, `otpHash`, `executionArn` ni claves de DynamoDB; que el OTP no viaje en la
respuesta; que los logs no incluyan el task token; y que un error inesperado no filtre stack
traces ni ARNs.

### Integracion

Corren contra DynamoDB Local con el repositorio real. Crean su propia tabla con nombre unico y
la borran al terminar.

Su valor esta en lo que un mock no puede verificar: que las `ConditionExpression` realmente
funcionen. Comprueban que dos decisiones simultaneas sobre el mismo aprobador dejen pasar solo
una, que el contador de intentos de OTP se incremente de forma atomica bajo concurrencia, que
una solicitud cerrada no se pueda reabrir y que no se pueda firmar sin OTP verificado.

No hay que activarlas a mano: `tests/setup.mts` comprueba si DynamoDB Local responde y decide.

| Situacion                    | Resultado                                  |
| ---------------------------- | ------------------------------------------ |
| `npm run local:up` levantado | Corren todas                               |
| Sin Docker                   | Se saltan las de integracion               |
| `RUN_INTEGRATION_TESTS=0`    | Se saltan aunque la base este arriba       |
| `RUN_INTEGRATION_TESTS=1`    | Se fuerzan y fallan si la base no responde |
