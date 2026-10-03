import { postToN8nWebhook, type N8nWebhookResult } from './n8n-webhook.client';

// Formato genérico de evento enviado a n8n (Fase 17 del plan maestro).
// Extensible a futuros "tipo": pedido_creado, inventario_bajo, credito_vencido, etc.
// El backend es la fuente de verdad del negocio: decide "tipo"/"titulo"/"mensaje";
// n8n solo decide cómo notificarlo (Telegram, y más adelante otros canales).
export type NotificationPriority = 'baja' | 'normal' | 'alta' | 'urgente';

export type NotificationEvent = {
  tipo: string;
  titulo: string;
  mensaje: string;
  prioridad?: NotificationPriority;
  entidad?: string;
  entidadId?: number;
  usuarioId?: number;
  metadata?: Record<string, unknown>;
};

export async function sendNotification(event: NotificationEvent): Promise<N8nWebhookResult> {
  const payload = {
    tipo: event.tipo,
    titulo: event.titulo,
    mensaje: event.mensaje,
    prioridad: event.prioridad ?? 'normal',
    entidad: event.entidad,
    entidadId: event.entidadId,
    usuarioId: event.usuarioId,
    metadata: event.metadata ?? {},
  };

  return postToN8nWebhook(payload);
}
