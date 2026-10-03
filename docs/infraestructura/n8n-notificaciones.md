# Integración de notificaciones: BASAN → n8n → Telegram

## Arquitectura (producción, VPS ya activo)

El backend **nunca** habla directamente con Telegram ni con ningún canal externo.
Solo declara QUÉ ocurrió y con qué datos; n8n decide la plantilla, el formato
final y el canal:

```
Backend → NotificationService.send(evento, datos) → N8nWebhookClient → HTTPS →
https://n8n.purificadorabasan.com/webhook/basan-notificaciones → n8n → Telegram
```

- `backend/src/services/n8n-webhook.client.ts`: cliente HTTP de bajo nivel
  (único punto que hace `fetch` hacia n8n). Maneja timeout, header
  `X-N8N-Webhook-Secret` y clasifica errores (`not_configured`, `timeout`,
  `network_error`, `http_client_error`, `http_server_error`). **No cambia**
  al agregar eventos nuevos.
- `backend/src/services/notification.service.ts`: `NotificationEvents`
  (constantes de evento) + `send(evento, datos)`. Único punto de entrada;
  ningún otro módulo debe hacer `fetch`/`axios` hacia n8n directamente.
- `POST /api/notifications/test`: endpoint autenticado (RBAC estándar) para
  verificar end-to-end con el evento `NotificationEvents.PRUEBA`.

En desarrollo local, `N8N_WEBHOOK_URL` puede quedar vacío: el cliente responde
`{ ok: false, reason: 'not_configured' }` sin lanzar excepción.

## Contrato de evento (genérico, un solo formato para todo)

```json
{
  "evento": "PEDIDO_CREADO",
  "datos": {
    "id": 10,
    "cliente": "Municipalidad",
    "productos": 1,
    "total": 28,
    "pago": "CONTADO",
    "estado": "PAGADO"
  }
}
```

El backend solo arma `datos` con valores reales del dominio (nunca strings de
Telegram ni Markdown). n8n resuelve la plantilla según `evento` y renderiza el
mensaje final.

## Eventos soportados (`NotificationEvents`)

| Evento | Emitido desde | Estado |
| --- | --- | --- |
| `PRUEBA` | `POST /api/notifications/test` | ✅ implementado |
| `PEDIDO_CREADO` | `sale.service.ts` → `createSale` (tras commit de la venta) | ✅ implementado |
| `PAGO_RECIBIDO` | — | plantilla lista en n8n, sin emisor en backend todavía |
| `STOCK_BAJO` | — | plantilla lista en n8n, sin emisor en backend todavía |
| `FACTURA_EMITIDA` | — | plantilla lista en n8n, sin emisor en backend todavía |
| `PEDIDO_ENTREGADO` | — | plantilla lista en n8n, sin emisor en backend todavía |
| `CREDITO_VENCIDO` | — | plantilla lista en n8n, sin emisor en backend todavía |

## Cómo agregar una notificación nueva

1. Agregar la clave a `NotificationEvents` en `notification.service.ts` (si no existe).
2. Agregar su plantilla en el nodo **Code** del workflow de n8n (objeto `TEMPLATES`,
   ver sección siguiente) — **no requiere crear un workflow ni nodo nuevo**.
3. Desde el módulo de negocio correspondiente, tras confirmar la operación:
   `send(NotificationEvents.X, { ...datos reales... })`, en modo fire-and-forget
   (`.then/.catch` con `console.error`, nunca `await` bloqueante, nunca debe
   hacer fallar la operación principal). Ver `notifyPedidoCreado` en
   `sale.service.ts` como referencia exacta a replicar.

## Mapeo de campos — `PEDIDO_CREADO`

`datos.id` = `Venta.NumeroVenta` (número de pedido visible al usuario), **no**
el `Id` interno de la fila — decisión explícita para que el mensaje de Telegram
sea legible para un humano.

| `datos.*` | Origen real (`sale.service.ts` → `toSaleDto`) |
| --- | --- |
| `id` | `sale.numeroVenta` |
| `cliente` | `sale.cliente.nombre` |
| `productos` | `sale.detalle.length` |
| `total` | `sale.total` |
| `pago` | `sale.condicionPago` |
| `estado` | `sale.estadoPago` |

## Variables de entorno

| Variable | Dev (local) | Producción (VPS, ya configurado) |
| --- | --- | --- |
| `N8N_WEBHOOK_URL` | vacío (responde `not_configured`) | `https://n8n.purificadorabasan.com/webhook/basan-notificaciones` |
| `N8N_WEBHOOK_SECRET` | vacío en pruebas | secreto real (no commiteado, vive solo en `backend/.env` local y en el entorno del VPS) |
| `N8N_WEBHOOK_TIMEOUT_MS` | `5000` (default) | `5000` |

## Dónde viven las plantillas (decisión arquitectónica)

**Centralizadas en n8n** (nodo Code, objeto `TEMPLATES`), no en una tabla de
base de datos del backend. Razones:
- El backend no debe conocer el formato de Telegram (requisito explícito).
- Administrar una plantilla ya es posible sin tocar el backend: se edita el
  nodo Code en la UI de n8n.
- Una tabla `NotificacionPlantilla` obligaría a crear CRUD + RBAC + migración
  solo para que n8n la consulte por HTTP — complejidad sin beneficio real hoy.
- Si en el futuro se necesita que personal no técnico edite plantillas desde
  una UI propia de BASAN, ahí sí se justificaría una tabla; no antes.

## Workflow único en n8n (un solo webhook para todos los eventos)

```
Webhook (POST /webhook/basan-notificaciones, Header Auth = X-N8N-Webhook-Secret)
   ↓
Code: construir mensaje (valida evento/datos, resuelve plantilla, interpola {campo}
       y {campo.anidado}, formatea montos con 2 decimales para total/monto/saldo)
   ↓
IF: ¿plantilla válida?
   ├─ true  → Telegram (Text = {{$json.mensajeTelegram}}, sin Markdown)
   │            → Respond to Webhook (200)
   └─ false → Respond to Webhook (400, mensaje de error)
```

La validación del secreto la hace el nodo **Webhook** nativamente (credencial
"Header Auth" apuntando a `N8N_WEBHOOK_SECRET`) — no requiere código custom.

### Código del nodo "Construir mensaje" (pegar tal cual)

```js
const input = $input.first().json;
const body = input.body ?? input;

const evento = body.evento;
const datos = body.datos ?? {};

if (!evento || typeof evento !== 'string') {
  return [{ json: { error: true, status: 400, message: 'Falta "evento" en el payload' } }];
}
if (!datos || typeof datos !== 'object') {
  return [{ json: { error: true, status: 400, message: 'Falta "datos" en el payload' } }];
}

// Agregar una notificación nueva = agregar una línea aquí. No crear otro nodo/workflow.
const TEMPLATES = {
  PRUEBA: '🔔 {mensaje}',
  PEDIDO_CREADO:
    '🔔 NUEVO PEDIDO\n\n📋 Pedido: #{id}\n👤 Cliente: {cliente}\n\n📦 Productos: {productos}\n💰 Total: Q{total}\n💳 Pago: {pago}\n📌 Estado: {estado}',
  PAGO_RECIBIDO:
    '💵 PAGO RECIBIDO\n\n👤 Cliente: {cliente}\n💰 Monto: Q{monto}\n📊 Saldo restante: Q{saldo}',
  STOCK_BAJO:
    '⚠️ STOCK BAJO\n\n📦 Producto: {producto}\n📉 Stock actual: {stock}\n📐 Mínimo requerido: {minimo}',
  FACTURA_EMITIDA:
    '🧾 FACTURA EMITIDA\n\n📋 Pedido: #{id}\n👤 Cliente: {cliente}\n💰 Total: Q{total}',
  PEDIDO_ENTREGADO: '🚚 PEDIDO ENTREGADO\n\n📋 Pedido: #{id}\n👤 Cliente: {cliente}',
  CREDITO_VENCIDO:
    '⏰ CRÉDITO VENCIDO\n\n👤 Cliente: {cliente}\n💰 Saldo: Q{saldo}\n📅 Venció: {fechaVencimiento}',
};

const MONEY_FIELDS = new Set(['total', 'monto', 'saldo']);

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), obj);
}

function formatValue(fieldPath, value) {
  const leafKey = fieldPath.split('.').pop();
  if (typeof value === 'number' && MONEY_FIELDS.has(leafKey)) {
    return value.toFixed(2);
  }
  return value === undefined || value === null ? '' : String(value);
}

function renderTemplate(template, datos) {
  return template.replace(/\{([\w.]+)\}/g, (_match, fieldPath) => formatValue(fieldPath, getNestedValue(datos, fieldPath)));
}

const template = TEMPLATES[evento];

if (!template) {
  return [{ json: { error: true, status: 400, message: `No existe plantilla activa para el evento "${evento}"` } }];
}

return [{ json: { error: false, evento, mensajeTelegram: renderTemplate(template, datos) } }];
```

Soporta propiedades anidadas (`{cliente.nombre}`, `{cliente.telefono}`) porque
`getNestedValue` recorre el `path` separado por `.`.

## Cómo probar

```powershell
# Login y token (ver backend/README.md para credenciales de desarrollo)
POST http://localhost:4000/api/auth/login

# Evento de prueba genérico
POST http://localhost:4000/api/notifications/test
Authorization: Bearer <token>
Content-Type: application/json
{ "datos": { "mensaje": "Prueba manual" } }

# Evento real: crear una venta desde el frontend (/sales/create) con
# "requiere factura" desmarcado. notifyPedidoCreado se dispara automáticamente
# tras confirmarse la venta.
```

## Problemas conocidos y solución

- **Mensaje llega vacío a Telegram**: revisar que el campo *Text* del nodo
  Telegram sea exactamente `={{ $json.mensajeTelegram }}` (con el `=` inicial
  para que n8n lo evalúe como expresión, no como texto literal).
- **403 en el Webhook**: la credencial *Header Auth* del nodo Webhook no
  coincide con `N8N_WEBHOOK_SECRET` del backend.
- **400 "No existe plantilla activa"**: el `evento` enviado no está en el
  objeto `TEMPLATES` del nodo Code — agregar la línea correspondiente.
- **Pie de página "This message was sent automatically with n8n"**: viene del
  nodo Telegram si tiene activada la opción de "attribution"; desactivarla en
  las opciones adicionales del nodo.

