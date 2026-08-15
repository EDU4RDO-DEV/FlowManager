import { describe, expect, it } from 'vitest';

import {
  createProductStructureSchema,
  deleteProductStructureBodySchema,
  restoreProductStructureBodySchema,
  updateProductStructureSchema,
} from '../validators/product-structure.validators';

describe('product-structure.validators', () => {
  it('valida payload minimo de creacion', () => {
    const parsed = createProductStructureSchema.parse({
      idProductoTerminado: 1,
      idMateriaPrima: 2,
      cantidadRequerida: 1.5,
    });

    expect(parsed.idProductoTerminado).toBe(1);
    expect(parsed.idMateriaPrima).toBe(2);
    expect(parsed.cantidadRequerida).toBe(1.5);
  });

  it('exige al menos un campo en actualizacion', () => {
    expect(() => updateProductStructureSchema.parse({})).toThrowError(
      /Debe enviar al menos un campo para actualizar/i,
    );
  });

  it('acepta cuerpos vacios en delete/restore cuando se usa req.auth.userId', () => {
    expect(deleteProductStructureBodySchema.parse({})).toEqual({});
    expect(restoreProductStructureBodySchema.parse({})).toEqual({});
  });

  it('rechaza ids de auditoria no positivos', () => {
    expect(() => deleteProductStructureBodySchema.parse({ idUsuarioAnulador: 0 })).toThrowError();
    expect(() => restoreProductStructureBodySchema.parse({ idUsuarioModificador: -1 })).toThrowError();
  });
});
