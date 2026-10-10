import { describe, expect, it } from 'vitest';

import { detectImageMimeFromBuffer, extensionFromMime } from '../utils/image-signature';

describe('image signature helpers', () => {
  it('detects png signature', () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);
    expect(detectImageMimeFromBuffer(buffer)).toBe('image/png');
  });

  it('detects jpeg signature', () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    expect(detectImageMimeFromBuffer(buffer)).toBe('image/jpeg');
  });

  it('detects webp signature', () => {
    const buffer = Buffer.from('RIFF1234WEBPVP8 ', 'ascii');
    expect(detectImageMimeFromBuffer(buffer)).toBe('image/webp');
  });

  it('returns null for unknown payload', () => {
    expect(detectImageMimeFromBuffer(Buffer.from('not-an-image'))).toBeNull();
  });

  it('maps mime to extension', () => {
    expect(extensionFromMime('image/png')).toBe('.png');
    expect(extensionFromMime('image/jpeg')).toBe('.jpg');
    expect(extensionFromMime('image/webp')).toBe('.webp');
  });
});
