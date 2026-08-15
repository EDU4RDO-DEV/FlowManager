# Paso 11 - Pruebas de flujo con stock y bitacora (compras/ajustes)

Fecha: 2026-08-15

## Alcance ejecutado

1. Compras (service)
- Archivo: backend/src/tests/purchase.service.spec.ts
- Cobertura de flujo agregada:
  - anular compra reduce existencia y registra bitacora `COMAN`.
  - restaurar compra incrementa existencia, limpia anulacion y registra bitacora `COMRES`.

2. Ajustes (service)
- Archivo: backend/src/tests/adjustment.service.spec.ts
- Cobertura de flujo agregada:
  - anular ajuste revierte stock y anula referencia de bitacora `AJ`.
  - restaurar ajuste reaplica stock y restaura referencia de bitacora `AJ`.

3. Enfoque tecnico
- Fixtures mockeados con transacciones simuladas para validar efectos de negocio.
- Verificaciones directas de llamadas a update/updateMany y a servicios de bitacora.

## Estado
Subpaso completado. Se cubren efectos funcionales criticos de anular/restaurar en inventario, no solo validaciones de entrada.
