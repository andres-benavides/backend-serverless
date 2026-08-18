# AMM Purchase Approvals

Prueba tecnica fullstack para gestionar solicitudes de compra con tres aprobaciones secuenciales.

## Estructura

```text
.
├── backend/   API serverless, DynamoDB, Step Functions y evidencia PDF
└── frontend/  React y micro-frontends con webpack Module Federation
```

- [Documentacion del backend](backend/README.md)
- [Documentacion del frontend](frontend/README.md)
- [Contrato OpenAPI](backend/docs/openapi.yaml)

## Requisitos

- Node.js 22
- AWS SAM CLI para el backend
- Docker para DynamoDB Local
- AWS CLI para los despliegues

## Instalacion

Cada proyecto conserva sus dependencias de manera independiente. La raiz solo instala Husky y
ofrece comandos coordinadores.

```bash
npm ci
npm --prefix backend ci
npm --prefix frontend ci
```

## Comandos generales

```bash
npm run check   # lint, formato y tipos de backend y frontend
npm test        # pruebas de backend y frontend
npm run build   # SAM build y build de los micro-frontends
```

Los comandos especificos se pueden ejecutar desde cada carpeta:

```bash
cd backend
npm test
sam build

cd ../frontend
npm test
npm run build
```

## Despliegue

Los despliegues se ejecutan desde la carpeta del proyecto correspondiente. Mover el codigo no
cambia los stacks existentes: se deben conservar sus nombres, region, perfil y parametros.

```bash
cd backend
sam build
sam deploy
```

```bash
cd frontend
aws cloudformation deploy \
  --template-file infrastructure/template.yaml \
  --stack-name amm-purchase-approvals-frontend
```
