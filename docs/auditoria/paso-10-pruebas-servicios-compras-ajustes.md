# Paso 10 - Pruebas de servicios: compras y ajustes (anular/restaurar)

Fecha: 2026-08-15

## Alcance ejecutado

1. Nueva suite de pruebas para compras
- Archivo: backend/src/tests/purchase.service.spec.ts
- Cobertura:
  - restauracion de compra inexistente/anulada no encontrada,
  - anulacion de compra inexistente,
  - restauracion de gasto inexistente,
  - validacion de usuario auditor en restauracion de gasto.

2. Nueva suite de pruebas para ajustes
- Archivo: backend/src/tests/adjustment.service.spec.ts
- Cobertura:
  - anulacion de ajuste inexistente,
  - restauracion de ajuste anulado inexistente,
  - validacion de usuario auditor antes de operar stock.

3. Estrategia tecnica
- Se usan fixtures mockeados de Prisma para cubrir reglas de negocio sin depender de datos reales en BD.
- Se verifica orden de validacion en rutas criticas (ejemplo: usuario auditor antes de afectar inventario).

## Estado
Subpaso completado. Se fortalece la capa de reglas de negocio en compras/ajustes con pruebas aisladas y reproducibles.
