import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import { postFelSoap } from '../services/fel.service';

let server: Server | undefined;

afterEach(async () => {
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  }
  server = undefined;
});

describe('FEL SOAP transport', () => {
  it('sends the SOAP body and action to the configured sandbox endpoint', async () => {
    let receivedAction = '';
    let receivedBody = '';
    server = createServer((request, response) => {
      receivedAction = String(request.headers.soapaction ?? '');
      request.setEncoding('utf8');
      request.on('data', (chunk: string) => {
        receivedBody += chunk;
      });
      request.on('end', () => {
        response.writeHead(200, { 'Content-Type': 'text/xml' });
        response.end('<ok/>');
      });
    });
    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));

    const { port } = server.address() as AddressInfo;
    const result = await postFelSoap(
      `http://127.0.0.1:${port}/sandbox`,
      'FELaction/ADOCUMENTO.Execute',
      '<soap>payload</soap>',
      { requireSsl: false, pfx: null, pfxPassword: null, timeoutMs: 2_000 },
    );

    expect(result).toBe('<ok/>');
    expect(receivedAction).toBe('FELaction/ADOCUMENTO.Execute');
    expect(receivedBody).toBe('<soap>payload</soap>');
  });

  it('rejects cleartext endpoints when TLS is required', async () => {
    await expect(
      postFelSoap(
        'http://127.0.0.1:1',
        'FELaction/ADOCUMENTO.Execute',
        '<soap/>',
        { requireSsl: true, pfx: null, pfxPassword: null, timeoutMs: 1_000 },
      ),
    ).rejects.toThrow('FEL: La configuración requiere un endpoint HTTPS');
  });
});
