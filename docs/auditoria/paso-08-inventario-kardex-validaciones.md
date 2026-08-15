# Paso 08 - Inventario Kardex: validaciones y consistencia de filtros

Fecha: 2026-08-15

## Alcance ejecutado

1. Backend kardex
- Se reforzo el endpoint de anulados para validar query con Zod.
- Se habilitaron filtros en anulados:
  - busqueda
  - tipoMovimiento
  - idInventarioItem
- Se unifico la construccion del where entre activo y anulado para evitar divergencias de criterio.

2. Frontend kardex
- Se ajusto guard de acceso a lectura por modulo:
  - RequireAuth moduleKey="inventario" action="read"

3. Pruebas
- Nueva suite: inventory-log.validators.spec.ts
- Cobertura agregada:
  - parse de query valida
  - limit fuera de rango
  - busqueda vacia
  - idInventarioItem no positivo

## Validacion tecnica
- Backend build: OK
- Backend tests: OK (21/21)
- Frontend build: OK

## Estado
Subpaso completado. Kardex queda con validacion mas consistente entre activos y anulados, y cobertura de pruebas de contrato de entrada.
