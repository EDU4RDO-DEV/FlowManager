# Integración de notificaciones: BASAN → n8n → Telegram

## Estado actual (desarrollo local)

El backend **nunca** habla directamente con Telegram ni con ningún canal externo.
Solo envía eventos genéricos a un webhook de n8n mediante HTTP POST:

```
Next.js → Backend/API → NotificationService → N8nWebhookClient → N8N_WEBHOOK_URL → n8n
```

- `backend/src/services/n8n-webhook.client.ts`: cliente HTTP de bajo nivel (único
  punto que hace `fetch` hacia n8n). Maneja timeout, secreto de autenticación y
  clasifica errores (`not_configured`, `timeout`, `network_error`,
  `http_client_error`, `http_server_error`).
- `backend/src/services/notification.service.ts`: `sendNotification(event)`,
  arma el payload genérico y delega en el cliente. Ningún otro módulo debe hacer
  `fetch`/`axios` hacia n8n directamente.
- `POST /api/notifications/test`: endpoint autenticado (RBAC estándar del
  sistema) para verificar end-to-end que el evento `tipo: "prueba"` llega a n8n.

En este entorno local, `N8N_WEBHOOK_URL` puede quedar vacío: el cliente responde
`{ ok: false, reason: 'not_configured' }` sin lanzar excepción y sin romper
ningún flujo de negocio.

## Contrato de evento (payload genérico)

```json
{
  "tipo": "prueba",
  "prioridad": "normal",
  "titulo": "Prueba de notificación",
  "mensaje": "Prueba de integración BASAN → n8n → Telegram",
  "entidad": "venta",
  "entidadId": 123,
  "usuarioId": 5,
  "metadata": {}
}
```

`tipo` es extensible a futuro (`pedido_creado`, `inventario_bajo`,
`credito_vencido`, `factura_generada`, `error_sistema`, etc.), pero **solo se
implementa `"prueba"` por ahora**. Cuando se agregue un evento de negocio real,
el backend sigue siendo quien decide `tipo`/`titulo`/`mensaje` (fuente de verdad);
n8n únicamente decide cómo notificarlo.

## Variables de entorno

| Variable | Dev (local) | Producción (VPS) |
| --- | --- | --- |
| `N8N_WEBHOOK_URL` | vacío o `http://localhost:5678/webhook/...` si se levanta n8n manualmente para pruebas puntuales | `https://n8n.midominio.com/webhook/...` |
| `N8N_WEBHOOK_SECRET` | vacío en pruebas locales | secreto real, generado al desplegar n8n |
| `N8N_WEBHOOK_TIMEOUT_MS` | `5000` (default) | ajustar según latencia real del VPS |

Nunca se hardcodean URLs, tokens ni el Bot Token de Telegram en el código: todo
viaja por variables de entorno del backend (lado BASAN) o por credenciales
internas de n8n (lado notificaciones), nunca mezclados.

## Infraestructura futura (VPS) — pendiente de implementar

n8n **no** se instala dentro de este repositorio ni como proceso Node junto al
backend. Es un servicio de infraestructura independiente:

```
VPS
 └─ Docker Compose
     ├─ PostgreSQL (base de datos de n8n)
     └─ n8n
          └─ Nginx (reverse proxy, TLS/HTTPS)
               └─ Webhook público de n8n
                    └─ Telegram (vía credencial de n8n, Bot Token propio de ese entorno)
```

Workflow inicial en n8n (a crear cuando el VPS esté listo):

```
Webhook (recibe el payload genérico de BASAN)
   ↓
Validación (tipo/titulo/mensaje presentes, secreto correcto)
   ↓
Preparar mensaje (formatear texto según "tipo"/"prioridad")
   ↓
Telegram (enviar mensaje)
   ↓
Webhook Response (200 OK)
```

El Bot Token de Telegram se configura **únicamente** como credencial dentro de
n8n (producción), nunca en `backend/.env` ni en este repositorio.

## Qué falta para notificaciones de negocio reales

1. Desplegar n8n en el VPS (Docker Compose + PostgreSQL + Nginx + HTTPS).
2. Configurar `N8N_WEBHOOK_URL` / `N8N_WEBHOOK_SECRET` en el `.env` de producción.
3. Crear el workflow Webhook → Validación → Telegram en la UI de n8n.
4. Recién entonces, ir agregando llamadas puntuales a `sendNotification(...)`
   desde los servicios de negocio que lo requieran (ej. `sale.service.ts` al
   crear una venta), un evento a la vez, sin modificar el cliente/servicio base.
