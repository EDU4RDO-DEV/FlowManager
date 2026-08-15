# Paso 09 - Pruebas de integracion RBAC y validacion de rutas criticas

Fecha: 2026-08-15

## Alcance ejecutado

1. Nueva suite de pruebas de integracion HTTP
- Archivo: backend/src/tests/module-endpoints-rbac.spec.ts

2. Casos agregados
- 403 al intentar restaurar ajuste con rol que solo tiene lectura de inventario.
- 403 al intentar restaurar compra con rol sin permisos de compras.
- 400 cuando `id` de restauracion de compra es invalido.
- 400 cuando kardex anulados recibe query invalida (`limit=101`).

## Objetivo de riesgo cubierto
- Detectar regresiones de permisos por accion en endpoints de restauracion.
- Validar contrato de entrada (params/query) en rutas sensibles sin depender de fixtures de base de datos.

## Estado
Subpaso completado. Queda fortalecida la capa de seguridad/contratos en rutas de inventario y compras.
