import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { postToN8nWebhook } from '../services/n8n-webhook.client';

describe('postToN8nWebhook', () => {
  const originalUrl = process.env.N8N_WEBHOOK_URL;
  const originalSecret = process.env.N8N_WEBHOOK_SECRET;
  const originalTimeout = process.env.N8N_WEBHOOK_TIMEOUT_MS;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.N8N_WEBHOOK_URL = 'http://localhost:5678/webhook/prueba';
    process.env.N8N_WEBHOOK_SECRET = 'secreto-test';
    process.env.N8N_WEBHOOK_TIMEOUT_MS = '5000';
  });

  afterEach(() => {
    process.env.N8N_WEBHOOK_URL = originalUrl;
    process.env.N8N_WEBHOOK_SECRET = originalSecret;
    process.env.N8N_WEBHOOK_TIMEOUT_MS = originalTimeout;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('retorna not_configured cuando N8N_WEBHOOK_URL no está definida', async () => {
    delete process.env.N8N_WEBHOOK_URL;

    const result = await postToN8nWebhook({ tipo: 'prueba' });

    expect(result).toEqual({
      ok: false,
      reason: 'not_configured',
      message: expect.stringContaining('N8N_WEBHOOK_URL'),
    });
  });

  it.each(['no-numérico', '-1', '0', '2147483648'])(
    'rechaza timeout inválido (%s) sin invocar el webhook',
    async (timeout) => {
      process.env.N8N_WEBHOOK_TIMEOUT_MS = timeout;
      global.fetch = vi.fn();

      const result = await postToN8nWebhook({ tipo: 'prueba' });

      expect(result).toEqual({
        ok: false,
        reason: 'invalid_timeout',
        message: expect.stringContaining('N8N_WEBHOOK_TIMEOUT_MS'),
      });
      expect(global.fetch).not.toHaveBeenCalled();
    },
  );

  it('acepta el máximo compatible con setTimeout', async () => {
    process.env.N8N_WEBHOOK_TIMEOUT_MS = '2147483647';
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 202 }) as unknown as typeof fetch;

    const result = await postToN8nWebhook({ tipo: 'prueba' });

    expect(result).toEqual({ ok: true, status: 202 });
  });

  it('retorna ok=true y status cuando n8n responde 200', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;

    const result = await postToN8nWebhook({ tipo: 'prueba' });

    expect(result).toEqual({ ok: true, status: 200 });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:5678/webhook/prueba',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-N8N-Webhook-Secret': 'secreto-test' }),
      }),
    );
  });

  it('clasifica HTTP 4xx como http_client_error', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 }) as unknown as typeof fetch;

    const result = await postToN8nWebhook({ tipo: 'prueba' });

    expect(result).toEqual({
      ok: false,
      reason: 'http_client_error',
      status: 400,
      message: expect.stringContaining('400'),
    });
  });

  it('clasifica HTTP 5xx como http_server_error', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 }) as unknown as typeof fetch;

    const result = await postToN8nWebhook({ tipo: 'prueba' });

    expect(result).toEqual({
      ok: false,
      reason: 'http_server_error',
      status: 503,
      message: expect.stringContaining('503'),
    });
  });

  it('clasifica AbortError como timeout', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    global.fetch = vi.fn().mockRejectedValue(abortError) as unknown as typeof fetch;

    const result = await postToN8nWebhook({ tipo: 'prueba' });

    expect(result).toEqual({
      ok: false,
      reason: 'timeout',
      message: expect.stringContaining('ms'),
    });
  });

  it('clasifica otros errores de fetch como network_error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const result = await postToN8nWebhook({ tipo: 'prueba' });

    expect(result).toEqual({
      ok: false,
      reason: 'network_error',
      message: 'ECONNREFUSED',
    });
  });

  it('nunca incluye el secreto en el mensaje de error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('fallo de red')) as unknown as typeof fetch;

    const result = await postToN8nWebhook({ tipo: 'prueba' });

    expect(JSON.stringify(result)).not.toContain('secreto-test');
  });
});
