# Frontend — Aprobaciones de compra

Micro-frontends con **webpack Module Federation**, React 18, React Router y `fetch`.

**Desplegado en https://dv25eqg0ezsqr.cloudfront.net**

## Estructura

```
frontend/
├── packages/
│   ├── api/        Cliente HTTP y tipos compartidos
│   └── ui/         shadcn/ui: componentes, tokens y cn()
└── apps/
    ├── shell/      Anfitrion: estructura, rutas y carga de modulos remotos
    ├── requester/  Remoto: crear solicitud, panel y detalle
    └── approver/   Remoto: OTP, detalle de compra y decision
```

La division no es arbitraria: son dos audiencias distintas. El solicitante utiliza el panel para
crear y consultar sus solicitudes, mientras que el aprobador llega desde un enlace de aprobacion
y solo ve la que le corresponde. Separarlos permite desplegar cambios del flujo de aprobacion sin
tocar el panel del solicitante.

Esta prueba no implementa autenticacion real: `requesterId` se recibe y se confia desde el
cliente. En produccion se obtendria de un API Gateway Authorizer respaldado por Cognito o JWT.

## Levantar

```bash
npm install
npm run dev
```

| Aplicacion | Puerto | Rol                                |
| ---------- | ------ | ---------------------------------- |
| shell      | 5170   | Anfitrion, se abre en el navegador |
| requester  | 5171   | Modulo remoto del solicitante      |
| approver   | 5172   | Modulo remoto del aprobador        |

Se eligieron puertos en el rango 5170+ porque 3000-4002 suelen estar ocupados por otros
servicios. Se pueden cambiar con `PORT`:

```bash
PORT=6000 npm run dev:shell
```

Cada modulo remoto tambien se ejecuta solo (`npm run dev:requester`), con su propio
`bootstrap.tsx`, lo que permite desarrollarlos de forma aislada.

### Apuntar a otro backend

```html
<script>
  window.__AMM_API_BASE_URL__ =
    'https://mi-api.execute-api.us-east-1.amazonaws.com/dev';
</script>
```

Sin esa variable se usa la URL del entorno de pruebas desplegado.

## Vistas

| Ruta                       | Aplicacion | Que hace                                         |
| -------------------------- | ---------- | ------------------------------------------------ |
| `/requests`                | requester  | Panel con las solicitudes y su estado            |
| `/requests/new`            | requester  | Formulario de creacion con los tres aprobadores  |
| `/requests/:id`            | requester  | Detalle, estado por aprobador y descarga del PDF |
| `/approve?approver_token=` | approver   | Pantalla de OTP y, tras validarlo, la decision   |

## Decisiones tecnicas

### Que se comparte y como

Los componentes de shadcn/ui **no** se comparten por federacion. shadcn copia codigo fuente, no
publica un paquete, asi que vive en `packages/ui` y cada app lo compila durante la construccion. Es lo
correcto para codigo fuente propio y evita una capa de indireccion innecesaria.

Lo que si se comparte durante la ejecucion, como `singleton`:

```js
(react, react - dom, react - router - dom, radix - ui);
```

Radix es el critico: usa React Context internamente. Dos copias durante la ejecucion significan dos
contextos distintos y los componentes con portal dejan de funcionar.

### Estilos

Solo el shell importa `globals.css`. Los modulos expuestos por los remotos no importan CSS, de
modo que no hay hojas de estilo duplicadas cuando se cargan dentro del anfitrion. Cada remoto si lo
importa en su propio `bootstrap.tsx`, que solo se usa al correrlo aislado.

### Tolerancia a fallos

`RemoteBoundary` es un limite de errores alrededor de los remotes. Si un `remoteEntry.js` no
responde, el shell muestra un mensaje en vez de quedarse en blanco. Es el modo de fallo mas
comun de Module Federation en desarrollo.

## Pruebas

```bash
npm test
npm run test:coverage
npm run typecheck
npm run lint
```

La cobertura global actual es de 88.62% de sentencias.

El umbral esta en 60%, el minimo que exige la prueba tecnica.

### Analisis estatico

ESLint corre con `typescript-eslint`, analisis de tipos y `eslint-plugin-react-hooks`. Este ultimo no
es cosmetico: detecta errores que TypeScript no ve. En su primera ejecucion encontro seis
problemas reales en este codigo.

`set-state-in-effect` marco cuatro vistas que llamaban `setState` de forma sincrona dentro de
un `useEffect`, provocando renders en cascada. Al corregirlas se aprovecho para cancelar la
peticion cuando el componente se desmonta, algo que faltaba.

`no-misused-promises` marco dos formularios que pasaban una funcion `async` directamente a
`onSubmit`, dejando cualquier rechazo sin manejar.

Los componentes generados por shadcn (`packages/ui/src/components/ui/`) estan excluidos: son
codigo de terceros que se actualiza con el CLI.

Las pruebas usan Testing Library con `fetch` simulado, asi que **no necesitan el backend
levantado**. Cubren los estados que suelen quedar sin probar: carga, vacio, error de red, error
de validacion del backend, intentos restantes de OTP, aprobacion fuera de turno y aprobacion ya
procesada.

## Construccion

```bash
npm run build
```

Genera `dist/` por aplicacion. Los dos modulos remotos emiten `remoteEntry.js`, que es el
manifiesto que consume el shell.

Para desplegar, cada aplicacion va a su propio origen y el shell necesita saber donde:

```bash
REQUESTER_REMOTE_URL=https://requester.example.com \
APPROVER_REMOTE_URL=https://approver.example.com \
npm run build -w @amm/shell
```

## Despliegue

Las tres aplicaciones son estaticas: se publican en un bucket S3 privado servido por una unica
distribucion de CloudFront.

```
/               shell (anfitrion)
/requester/     remoto
/approver/      remoto
```

### Infraestructura

```bash
aws cloudformation deploy \
  --template-file infrastructure/template.yaml \
  --stack-name amm-purchase-approvals-frontend \
  --profile <perfil> --region us-east-1
```

`--profile` se puede omitir cuando se utiliza el perfil predeterminado de AWS CLI.

El bucket **no** usa alojamiento web ni politica publica. CloudFront accede con Origin Access
Control firmando cada peticion con SigV4, y la politica del bucket solo confia en esa
distribucion concreta mediante `AWS:SourceArn`. Acceder al bucket directo devuelve 403.

### Publicar

Cada aplicacion se construye con el `publicPath` de su prefijo, o sus fragmentos no resuelven:

```bash
SITE=https://dv25eqg0ezsqr.cloudfront.net

PUBLIC_PATH=/requester/ npm run build -w @amm/requester
PUBLIC_PATH=/approver/  npm run build -w @amm/approver

REQUESTER_REMOTE_URL="$SITE/requester" \
APPROVER_REMOTE_URL="$SITE/approver" \
npm run build -w @amm/shell
```

El shell necesita conocer la URL de los modulos remotos durante la construccion, asi que la
infraestructura se despliega primero y su dominio se pasa por variable de entorno.

```bash
BUCKET=<BucketName del stack>

aws s3 sync apps/requester/dist "s3://$BUCKET/requester" --delete
aws s3 sync apps/approver/dist  "s3://$BUCKET/approver"  --delete
aws s3 sync apps/shell/dist     "s3://$BUCKET" --exclude "requester/*" --exclude "approver/*"

aws cloudfront create-invalidation --distribution-id <DistributionId> --paths "/*"
```

### Enrutamiento del SPA

La distribucion traduce los errores 403 y 404 a `/index.html` con codigo 200. Sin eso, entrar
directo a `/requests/new` daria 404: ese objeto no existe en S3, la ruta la resuelve React
Router en el cliente.
