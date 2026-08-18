# AMM Purchase Approvals

Prueba tecnica de desarrollo full stack para gestionar solicitudes de compra con tres
aprobaciones secuenciales.

## Demostracion

| Recurso        | URL                                                                  |
| -------------- | -------------------------------------------------------------------- |
| Aplicacion     | https://dv25eqg0ezsqr.cloudfront.net                                 |
| API            | https://t1nma1q8f3.execute-api.us-east-1.amazonaws.com/dev           |
| Buzon simulado | https://t1nma1q8f3.execute-api.us-east-1.amazonaws.com/dev/mock-mail |

## Estructura

```text
.
├── backend/   API sin servidores, DynamoDB, Step Functions y evidencia PDF
└── frontend/  React y micro-frontends con webpack Module Federation
```

- [Documentacion del backend](backend/README.md)
- [Documentacion del frontend](frontend/README.md)
- [Contrato OpenAPI](backend/docs/openapi.yaml)

## Tecnologias principales

- Backend: API Gateway, Lambda con Node.js 22 y TypeScript, DynamoDB, Step Functions y S3.
- Frontend: React 18, React Router, webpack Module Federation, S3 y CloudFront.

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
npm run build   # construccion de SAM y de los micro-frontends
```

Para obtener los reportes completos de cobertura:

```bash
npm --prefix backend run test:coverage
npm --prefix frontend run test:coverage
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
sam deploy \
  --profile <perfil> \
  --region us-east-1 \
  --parameter-overrides \
  AppBaseUrl=https://<distribucion>.cloudfront.net
```

```bash
cd frontend
aws cloudformation deploy \
  --template-file infrastructure/template.yaml \
  --stack-name amm-purchase-approvals-frontend \
  --profile <perfil> \
  --region us-east-1
```

`--profile` se puede omitir cuando se utiliza el perfil predeterminado de AWS CLI. Los detalles
de arquitectura, desarrollo local y publicación están en los README de cada proyecto.
