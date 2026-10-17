import { describe, expect, it } from 'vitest';

import { rolePermissionEntrySchema } from '../validators/role-permission.validators';

describe('role permission module catalog', () => {
  it('accepts independent dispatch permissions', () => {
    expect(rolePermissionEntrySchema.parse({
      moduleKey: 'despacho',
      action: 'create',
      permitido: true,
    })).toEqual({
      moduleKey: 'despacho',
      action: 'create',
      permitido: true,
    });
  });
});
