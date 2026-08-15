# Paso 13 - Normalizacion categoria vs producto final

## Objetivo
Eliminar la redundancia entre `categoria` y `esProductoFinal`, dejando `categoria` como unica fuente de verdad.

## Cambios aplicados

### Backend
- Se elimino `esProductoFinal` de:
  - query y payloads de `backend/src/validators/product.validators.ts`.
  - parseo de filtros en `backend/src/controllers/product.controller.ts`.
  - DTOs y filtros de `backend/src/services/product.service.ts`.
- Se actualizo estructura BOM para validar producto terminado por categoria (`PRODUCTO_TERMINADO`) en `backend/src/services/product-structure.service.ts`.

### Frontend
- Se removio `esProductoFinal` de tipos y contratos:
  - `frontend/types/products.ts`
  - `frontend/types/product-structure.ts`
- Se elimino el filtro `esProductoFinal` del cliente API:
  - `frontend/services/products.service.ts`
- Se retiro checkbox de formulario de producto:
  - `frontend/app/inventory/_components/product-form-card.tsx`
- Se ajustaron pantallas para derivar "producto final" por categoria:
  - `frontend/app/inventory/create/page.tsx`
  - `frontend/app/inventory/edit/[id]/page.tsx`
  - `frontend/app/inventory/page.tsx`
  - `frontend/app/inventory/structure/page.tsx`

### Modelo de datos
- Se elimino `EsProductoFinal` del modelo Prisma:
  - `backend/prisma/schema.prisma`
- Se elimino `EsProductoFinal` del script base SQL:
  - `Base de Datos - FlowManager.sql`
- Se agrego script de migracion SQL Server:
  - `backend/scripts/2026-11-01-drop-es-producto-final.sql`

## Validacion tecnica
Comandos ejecutados:

```bash
cd backend
pnpm test
pnpm build

cd ../frontend
pnpm build
```

Resultado:
- Backend tests: 42/42 en verde.
- Backend build: OK.
- Frontend build: OK.

## Nota de despliegue
Antes de ejecutar el backend en ambientes con BD existente, aplicar:

```sql
-- backend/scripts/2026-11-01-drop-es-producto-final.sql
```

Luego regenerar cliente Prisma si el archivo bloqueado ya no presenta EPERM:

```bash
cd backend
pnpm exec prisma generate
```
