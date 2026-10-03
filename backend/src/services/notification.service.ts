import { postToN8nWebhook, type N8nWebhookResult } from './n8n-webhook.client';

// Sistema centralizado de notificaciones: el backend solo declara QUÉ ocurrió
// ("evento") y los datos asociados; n8n decide la plantilla, el formato final
// y el canal (Telegram hoy, otros mañana). Un único workflow en n8n procesa
// todos los eventos — agregar un evento nuevo NO requiere tocar el backend
// más que emitirlo desde el módulo correspondiente.
export const NotificationEvents = {
  PRUEBA: 'PRUEBA',
  PEDIDO_CREADO: 'PEDIDO_CREADO',
  PAGO_RECIBIDO: 'PAGO_RECIBIDO',
  VENTA_ANULADA: 'VENTA_ANULADA',
  STOCK_BAJO: 'STOCK_BAJO',
  FACTURA_EMITIDA: 'FACTURA_EMITIDA',
  VEHICULO_NO_DISPONIBLE: 'VEHICULO_NO_DISPONIBLE',
  PEDIDO_ENTREGADO: 'PEDIDO_ENTREGADO',
  CREDITO_VENCIDO: 'CREDITO_VENCIDO',
} as const;

export type NotificationEventName = (typeof NotificationEvents)[keyof typeof NotificationEvents];

export async function send(
  evento: NotificationEventName,
  datos: Record<string, unknown>,
): Promise<N8nWebhookResult> {
  return postToN8nWebhook({ evento, datos });
}

