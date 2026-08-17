# Frontend — Aprobaciones de compra

Micro-frontends con **webpack Module Federation**, React 18, React Router y `fetch`.

## Estructura

```
frontend/
├── packages/
│   ├── api/        Cliente HTTP y tipos compartidos
│   └── ui/         shadcn/ui: componentes, tokens y cn()
└── apps/
    ├── shell/      Host: layout, router, carga los remotes
    ├── requester/  Remote: crear solicitud, panel, detalle
    └── approver/   Remote: OTP, detalle de compra, aprobar/rechazar
```

La division no es arbitraria: son dos audiencias distintas. El solicitante entra autenticado a
su panel; el aprobador llega desde un link de correo y solo ve su aprobacion. Separarlos permite
desplegar cambios del flujo de aprobacion sin tocar el panel del solicitante.

## Levantar

```bash
npm install
npm run dev
```

| App       | Puerto | Rol                                     |
| --------- | ------ | --------------------------------------- |
| shell     | 5170   | Host, es el que se abre en el navegador |
| requester | 5171   | Remote                                  |
| approver  | 5172   | Remote                                  |

Se eligieron puertos en el rango 5170+ porque 3000-4002 suelen estar ocupados por otros
servicios. Se pueden cambiar con `PORT`:

```bash
PORT=6000 npm run dev:shell
```

Cada remote tambien corre solo (`npm run dev:requester`), con su propio `bootstrap.tsx`, lo que
permite desarrollarlos de forma aislada.

### Apuntar a otro backend

```html
<script>
  window.__AMM_API_BASE_URL__ =
    'https://mi-api.execute-api.us-east-1.amazonaws.com/dev';
</script>
```

Sin esa variable se usa la URL del entorno de pruebas desplegado.

## Vistas

| Ruta                       | App       | Que hace                                         |
| -------------------------- | --------- | ------------------------------------------------ |
| `/requests`                | requester | Panel con las solicitudes y su estado            |
| `/requests/new`            | requester | Formulario de creacion con los tres aprobadores  |
| `/requests/:id`            | requester | Detalle, estado por aprobador y descarga del PDF |
| `/approve?approver_token=` | approver  | Pantalla de OTP y, tras validarlo, la decision   |

## Decisiones tecnicas

### Que se comparte y como

Los componentes de shadcn/ui **no** se comparten por federacion. shadcn copia codigo fuente, no
publica un paquete, asi que vive en `packages/ui` y cada app lo compila en build time. Es lo
correcto para codigo fuente propio y evita una capa de indireccion innecesaria.

Lo que si se comparte en runtime, como `singleton`:

```js
(react, react - dom, react - router - dom, radix - ui);
```

Radix es el critico: usa React Context internamente. Dos copias en runtime significan dos
contextos distintos y los componentes con portal dejan de funcionar.

### Estilos

Solo el shell importa `globals.css`. Los modulos expuestos por los remotes no importan CSS, de
modo que no hay hojas de estilo duplicadas cuando se cargan dentro del host. Cada remote si lo
importa en su propio `bootstrap.tsx`, que solo se usa al correrlo aislado.

### Tolerancia a fallos

`RemoteBoundary` es un error boundary alrededor de los remotes. Si un `remoteEntry.js` no
responde, el shell muestra un mensaje en vez de quedarse en blanco. Es el modo de fallo mas
comun de Module Federation en desarrollo.

## Pruebas

```bash
npm test
npm run test:coverage
npm run typecheck
npm run lint
```

```
43 pruebas | 4 archivos
Cobertura: 89% sentencias | 87% ramas | 94% funciones
```

El umbral esta en 60%, el minimo que exige la prueba tecnica.

### Linting

ESLint corre con `typescript-eslint` type-checked y `eslint-plugin-react-hooks`. Este ultimo no
es cosmetico: detecta errores que TypeScript no ve. En su primera ejecucion encontro seis
problemas reales en este codigo.

`set-state-in-effect` marco cuatro vistas que llamaban `setState` de forma sincrona dentro de
un `useEffect`, provocando renders en cascada. Al corregirlas se aprovecho para cancelar la
peticion cuando el componente se desmonta, algo que faltaba.

`no-misused-promises` marco dos formularios que pasaban una funcion `async` directamente a
`onSubmit`, dejando cualquier rechazo sin manejar.

Los componentes generados por shadcn (`packages/ui/src/components/ui/`) estan excluidos: son
codigo de terceros que se actualiza con el CLI.

Las pruebas usan Testing Library con `fetch` mockeado, asi que **no necesitan el backend
levantado**. Cubren los estados que suelen quedar sin probar: carga, vacio, error de red, error
de validacion del backend, intentos restantes de OTP, aprobacion fuera de turno y aprobacion ya
procesada.

## Build

```bash
npm run build
```

Genera `dist/` por app. Los dos remotes emiten `remoteEntry.js`, que es el manifiesto que el
shell consume.

Para desplegar, cada app va a su propio origen y el shell necesita saber donde:

```bash
REQUESTER_REMOTE_URL=https://requester.example.com \
APPROVER_REMOTE_URL=https://approver.example.com \
npm run build -w @amm/shell
```
