// Cliente HTTP de bajo nivel hacia n8n. Única responsabilidad: hacer el POST al
// webhook configurado, con el secreto de autenticación y timeout, y clasificar el
// resultado. No conoce reglas de negocio ni formatea mensajes para ningún canal.
export type N8nWebhookSuccess = {
  ok: true;
  status: number;
};

export type N8nWebhookFailureReason =
  | 'not_configured'
  | 'timeout'
  | 'network_error'
  | 'http_client_error'
  | 'http_server_error';

export type N8nWebhookFailure = {
  ok: false;
  reason: N8nWebhookFailureReason;
  status?: number;
  message: string;
};

export type N8nWebhookResult = N8nWebhookSuccess | N8nWebhookFailure;

const DEFAULT_TIMEOUT_MS = 5000;

export async function postToN8nWebhook(body: unknown): Promise<N8nWebhookResult> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    return {
      ok: false,
      reason: 'not_configured',
      message: 'N8N_WEBHOOK_URL no está configurada en el servidor',
    };
  }

  const secret = process.env.N8N_WEBHOOK_SECRET;
  const timeoutMs = Number(process.env.N8N_WEBHOOK_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'X-N8N-Webhook-Secret': secret } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.ok) {
      return { ok: true, status: response.status };
    }

    const reason: N8nWebhookFailureReason =
      response.status >= 500 ? 'http_server_error' : 'http_client_error';

    return {
      ok: false,
      reason,
      status: response.status,
      message: `n8n respondió HTTP ${response.status}`,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        ok: false,
        reason: 'timeout',
        message: `n8n no respondió en ${timeoutMs}ms`,
      };
    }

    return {
      ok: false,
      reason: 'network_error',
      message: error instanceof Error ? error.message : 'Error de red desconocido',
    };
  } finally {
    clearTimeout(timeout);
  }
}
